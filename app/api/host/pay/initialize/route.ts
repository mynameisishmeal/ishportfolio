import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import { isSafeHttpUrl } from '@/lib/format';
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
import { resolveSafeOrigin, safeErrorMessage, verifySameOrigin } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const csrfError = verifySameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError }, { status: 403 });
    }

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

    if (includeRedirect && redirectTargetUrl && !isSafeHttpUrl(redirectTargetUrl)) {
      return NextResponse.json(
        { success: false, error: 'Redirect target URL must be a valid http:// or https:// URL' },
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

    const origin = resolveSafeOrigin(request);
    // Avoid hash fragment in callback_url because Paystack appends query params (&trxref=&reference=)
    const callbackUrl = `${origin}/?host_ref=${encodeURIComponent(paymentReference)}`;

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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to initialize hosting payment') },
      { status: 500 }
    );
  }
}
