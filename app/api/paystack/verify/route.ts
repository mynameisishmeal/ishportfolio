import { NextResponse } from 'next/server';
import {
  getOrderByPaymentReference,
  getPaystackConfig,
  markOrderPaidByReference,
} from '@/lib/store';
import { isAdminAuthenticated } from '@/lib/auth';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { checkPersistentRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';
import { notifyOrderToTelegram } from '@/lib/telegram';
import { safeErrorMessage } from '@/lib/security';

export const dynamic = 'force-dynamic';

const REF_PATTERN = /^[a-zA-Z0-9_-]{6,100}$/;

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rate = await checkPersistentRateLimit({
      namespace: 'paystack-verify',
      key: ip,
      maxRequests: 20,
      windowMs: 5 * 60_000,
    });
    const rlHeaders = rateLimitHeaders(rate);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many verification attempts. Please wait a moment.' },
        { status: 429, headers: rlHeaders }
      );
    }

    const [user, isAdmin] = await Promise.all([
      getAuthenticatedHostUser(request),
      isAdminAuthenticated(),
    ]);
    if (!user && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Please sign in with your Access Key to verify this order.' },
        { status: 401, headers: rlHeaders }
      );
    }

    const url = new URL(request.url);
    const reference = url.searchParams.get('reference')?.trim() || '';

    if (!REF_PATTERN.test(reference)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment reference.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const existing = await getOrderByPaymentReference(reference);
    if (!existing || (!isAdmin && (!existing.userId || existing.userId !== user?.id))) {
      return NextResponse.json(
        { success: false, error: 'Order not found for this payment reference.' },
        { status: 404, headers: rlHeaders }
      );
    }

    if (existing.paymentStatus === 'paid') {
      return NextResponse.json(
        {
          success: true,
          verified: true,
          order: existing,
        },
        { headers: rlHeaders }
      );
    }

    const cfg = await getPaystackConfig();
    if (!cfg.secretKey) {
      return NextResponse.json(
        { success: false, error: 'Paystack Secret Key is not configured.' },
        { status: 500, headers: rlHeaders }
      );
    }

    const verification = await verifyPaystackTransaction({
      secretKey: cfg.secretKey,
      reference,
    });

    if (!verification.ok || !verification.data) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Could not verify Paystack payment.' },
        { status: 400, headers: rlHeaders }
      );
    }

    const tx = verification.data;
    const expectedMinor = Math.round(existing.total * 100);
    const currencyMatches =
      tx.currency.toUpperCase() === (existing.currencyCode || 'NGN').toUpperCase();

    if (
      tx.status !== 'success' ||
      tx.reference !== existing.paymentReference ||
      tx.amount < expectedMinor ||
      !currencyMatches
    ) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: `Payment was not completed (${tx.status || 'unverified'}).`,
        },
        { status: 400, headers: rlHeaders }
      );
    }

    const result = await markOrderPaidByReference(reference);
    const finalOrder = result.order ?? existing;

    if (result.newlyPaid) {
      await notifyOrderToTelegram(finalOrder);
    }

    return NextResponse.json(
      {
        success: true,
        verified: true,
        order: finalOrder,
      },
      { headers: rlHeaders }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Failed to verify Paystack transaction') },
      { status: 500 }
    );
  }
}
