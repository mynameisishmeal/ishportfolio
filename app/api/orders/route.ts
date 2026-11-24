import { NextResponse } from 'next/server';
import {
  createOrder,
  getBankTransferConfig,
  getOrderByPaymentReference,
  getOrders,
} from '@/lib/store';
import { generateNarrationCode } from '@/lib/format';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import {
  checkRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { notifyOrderToTelegram } from '@/lib/telegram';

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const orders = await getOrders();
    return NextResponse.json({ success: true, orders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch orders';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedHostUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please sign in or create an Access Key first to place a shop order.',
        },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit({
      namespace: 'orders-ip',
      key: `${ip}:${user.id}`,
      maxRequests: 8,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many order attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
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
    const paymentMethod =
      typeof body?.paymentMethod === 'string' ? body.paymentMethod.trim() : 'Bank Transfer';
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
    const rawRef =
      typeof body?.paymentReference === 'string'
        ? body.paymentReference.trim().toUpperCase()
        : '';

    if (!items.length) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one item to order.' },
        { status: 400, headers: rlHeaders }
      );
    }

    if (paymentMethod !== 'Bank Transfer') {
      return NextResponse.json(
        {
          success: false,
          error: 'Shop orders only support Paystack or Direct Bank Transfer.',
        },
        { status: 400, headers: rlHeaders }
      );
    }

    const bankCfg = await getBankTransferConfig();
    if (!bankCfg.enabled || !bankCfg.bankName || !bankCfg.accountName || !bankCfg.accountNumber) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Direct Bank Transfer is not active yet. Configure Bank Transfer in Admin -> Profile & Settings.',
        },
        { status: 400, headers: rlHeaders }
      );
    }

    const validFormat = /^[A-Z0-9-]{6,32}$/.test(rawRef);
    let paymentReference = validFormat ? rawRef : generateNarrationCode('OBT');
    if (validFormat && (await getOrderByPaymentReference(paymentReference))) {
      return NextResponse.json(
        {
          success: false,
          error: 'This narration code was already used. Please use a fresh narration code.',
        },
        { status: 409, headers: rlHeaders }
      );
    }
    while (await getOrderByPaymentReference(paymentReference)) {
      paymentReference = generateNarrationCode('OBT');
    }

    const result = await createOrder({
      userId: user.id,
      keyHint: user.keyHint,
      items: items.map((i: { productId: string; quantity: number }) => ({
        productId: String(i.productId),
        quantity: Number(i.quantity) || 1,
      })),
      paymentMethod: 'Bank Transfer',
      paymentStatus: 'pending',
      paymentReference,
      customerName,
      customerEmail,
      notes,
    });

    if (result.error || !result.order) {
      return NextResponse.json(
        { success: false, error: result.error || 'Could not create order.' },
        { status: 400 }
      );
    }

    await notifyOrderToTelegram(result.order);

    return NextResponse.json(
      { success: true, order: result.order },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
