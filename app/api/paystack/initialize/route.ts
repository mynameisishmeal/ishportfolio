import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import {
  createOrder,
  getPaystackConfig,
  rollbackOrderAndStock,
} from '@/lib/store';
import { initializePaystackTransaction } from '@/lib/paystack';
import {
  checkRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { resolveSafeOrigin, safeErrorMessage, verifySameOrigin } from '@/lib/security';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

    const user = await getAuthenticatedHostUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please sign in or create an Access Key first to pay with Paystack.',
        },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit({
      namespace: 'paystack-init',
      key: `${ip}:${user.id}`,
      maxRequests: 8,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many checkout attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const botError = detectBotPayload(body);
    if (botError) {
      return NextResponse.json({ success: false, error: botError }, { status: 400 });
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    const customerName =
      (typeof body?.customerName === 'string' ? body.customerName.trim() : '') || user.name;
    const customerEmail =
      (typeof body?.customerEmail === 'string' ? body.customerEmail.trim() : '') || user.email;
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

    if (!items.length || items.length > 50 || !customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Please select between 1 and 50 items to pay.' },
        { status: 400, headers: rlHeaders }
      );
    }

    if (!EMAIL_PATTERN.test(customerEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address for Paystack.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const paystackCfg = await getPaystackConfig();
    if (!paystackCfg.enabled || !paystackCfg.secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paystack is not active yet',
        },
        { status: 400, headers: rlHeaders }
      );
    }

    const paymentReference = `PSK-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;

    const orderResult = await createOrder({
      userId: user.id,
      keyHint: user.keyHint,
      items: items.map((i: { productId: string; quantity: number }) => ({
        productId: String(i.productId),
        quantity: Number(i.quantity) || 1,
      })),
      paymentMethod: 'Paystack',
      paymentStatus: 'pending',
      paymentReference,
      customerName,
      customerEmail,
      notes,
    });

    if (orderResult.error || !orderResult.order) {
      return NextResponse.json(
        { success: false, error: orderResult.error || 'Could not create order.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const order = orderResult.order;
    const amountMinor = Math.round(order.total * 100);
    if (amountMinor < 100) {
      await rollbackOrderAndStock(order.id);
      return NextResponse.json(
        { success: false, error: 'Order total is too small for Paystack checkout.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const origin = resolveSafeOrigin(request);
    const callbackUrl = `${origin}/?paystack_ref=${encodeURIComponent(paymentReference)}`;

    const init = await initializePaystackTransaction({
      secretKey: paystackCfg.secretKey,
      email: order.customerEmail,
      amountMinor,
      currency: order.currencyCode || 'NGN',
      reference: paymentReference,
      callbackUrl,
      metadata: {
        orderId: order.id,
        customerName: order.customerName,
        itemsCount: order.items.length,
      },
    });

    if (!init.ok || !init.authorizationUrl) {
      await rollbackOrderAndStock(order.id);
      return NextResponse.json(
        { success: false, error: init.error || 'Failed to start Paystack payment.' },
        { status: 400, headers: rlHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authorizationUrl: init.authorizationUrl,
        reference: paymentReference,
        orderId: order.id,
      },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to initialize Paystack checkout') },
      { status: 500 }
    );
  }
}
