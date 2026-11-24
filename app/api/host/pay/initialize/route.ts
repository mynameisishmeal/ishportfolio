import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import {
  createHostingRequest,
  getPaystackConfig,
  rollbackHostingRequest,
} from '@/lib/store';
import { initializePaystackTransaction } from '@/lib/paystack';
import {
  checkRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';

function resolveRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedHostUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Please sign in or create an account first.' },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit({
      namespace: 'host-pay-init',
      key: `${ip}:${user.id}`,
      maxRequests: 8,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many payment attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
        },
        { status: 429, headers: rlHeaders }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const botError = detectBotPayload(body);
    if (botError) {
      return NextResponse.json({ success: false, error: botError }, { status: 400 });
    }

    const projectName =
      typeof body?.projectName === 'string' && body.projectName.trim()
        ? body.projectName.trim().slice(0, 120)
        : 'Hosted Project';
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 1000) : '';
    const includeRedirect = Boolean(body?.includeRedirect);
    const redirectTargetUrl =
      typeof body?.redirectTargetUrl === 'string'
        ? body.redirectTargetUrl.trim().slice(0, 300)
        : '';

    if (includeRedirect && redirectTargetUrl && !/^https?:\/\//i.test(redirectTargetUrl)) {
      return NextResponse.json(
        { success: false, error: 'Redirect target URL must start with http:// or https://' },
        { status: 400, headers: rlHeaders }
      );
    }

    const paystackCfg = await getPaystackConfig();
    if (!paystackCfg.enabled || !paystackCfg.secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paystack checkout is not configured yet. Please enable Paystack in Admin -> Profile & Settings.',
        },
        { status: 400, headers: rlHeaders }
      );
    }

    const paymentReference = `HPSK-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;

    const hostRequest = await createHostingRequest({
      user,
      projectName,
      notes,
      includeRedirect,
      redirectTargetUrl,
      paymentMethod: 'Paystack',
      paymentReference,
    });

    const amountMinor = Math.round(hostRequest.amount * 100);
    if (amountMinor < 100) {
      await rollbackHostingRequest(hostRequest.id);
      return NextResponse.json(
        { success: false, error: 'Hosting price is invalid.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const origin = resolveRequestOrigin(request);
    const callbackUrl = `${origin}/?host_ref=${encodeURIComponent(paymentReference)}#host`;

    const init = await initializePaystackTransaction({
      secretKey: paystackCfg.secretKey,
      email: user.email,
      amountMinor,
      currency: hostRequest.currencyCode || 'NGN',
      reference: paymentReference,
      callbackUrl,
      metadata: {
        kind: 'zip_hosting',
        hostingRequestId: hostRequest.id,
        userId: user.id,
        projectName: hostRequest.projectName,
      },
    });

    if (!init.ok || !init.authorizationUrl) {
      await rollbackHostingRequest(hostRequest.id);
      return NextResponse.json(
        { success: false, error: init.error || 'Could not start Paystack payment.' },
        { status: 400, headers: rlHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authorizationUrl: init.authorizationUrl,
        reference: paymentReference,
        requestId: hostRequest.id,
      },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initialize hosting payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
