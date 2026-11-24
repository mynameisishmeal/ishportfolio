import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import { generateNarrationCode } from '@/lib/format';
import {
  createHostingRequest,
  getBankTransferConfig,
  getHostingRequestByPaymentReference,
} from '@/lib/store';
import {
  checkRateLimit,
  detectBotPayload,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { notifyHostBankTransferToTelegram } from '@/lib/telegram';

const NARRATION_PATTERN = /^[A-Z0-9-]{6,32}$/;

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
      namespace: 'host-bank-submit',
      key: `${ip}:${user.id}`,
      maxRequests: 8,
      windowMs: 15 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many transfer submissions. Please wait ${rate.retryAfterSeconds}s and try again.`,
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
    const rawNarration =
      typeof body?.narrationCode === 'string'
        ? body.narrationCode.trim().toUpperCase()
        : '';
    const transferProof =
      typeof body?.transferProof === 'string'
        ? body.transferProof.trim().slice(0, 200)
        : '';

    if (includeRedirect && redirectTargetUrl && !/^https?:\/\//i.test(redirectTargetUrl)) {
      return NextResponse.json(
        { success: false, error: 'Redirect target URL must start with http:// or https://' },
        { status: 400, headers: rlHeaders }
      );
    }

    const bankCfg = await getBankTransferConfig();
    if (!bankCfg.enabled || !bankCfg.bankName || !bankCfg.accountName || !bankCfg.accountNumber) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Direct Bank Transfer is not configured yet. Please enable Bank Transfer in Admin -> Profile & Settings.',
        },
        { status: 400, headers: rlHeaders }
      );
    }

    let paymentReference = NARRATION_PATTERN.test(rawNarration)
      ? rawNarration
      : generateNarrationCode('HBT');

    if (rawNarration && NARRATION_PATTERN.test(rawNarration)) {
      const existingByRef = await getHostingRequestByPaymentReference(paymentReference);
      if (existingByRef) {
        return NextResponse.json(
          {
            success: false,
            error:
              'This narration code was already used for another deployment. Click "New Code" to generate a fresh code.',
          },
          { status: 409, headers: rlHeaders }
        );
      }
    } else {
      while (await getHostingRequestByPaymentReference(paymentReference)) {
        paymentReference = generateNarrationCode('HBT');
      }
    }

    const hostRequest = await createHostingRequest({
      user,
      projectName,
      notes,
      includeRedirect,
      redirectTargetUrl,
      paymentMethod: 'Bank Transfer',
      ...(transferProof ? { transferProof } : {}),
      paymentReference,
    });

    await notifyHostBankTransferToTelegram(hostRequest);

    return NextResponse.json(
      { success: true, request: hostRequest },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit bank transfer request';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
