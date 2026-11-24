import { NextResponse } from 'next/server';
import { getAuthenticatedHostUser } from '@/lib/host-auth';
import {
  getHostingRequestByPaymentReference,
  getPaystackConfig,
  markHostingPaidByReference,
} from '@/lib/store';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { notifyHostPaidToTelegram } from '@/lib/telegram';

const REF_PATTERN = /^[a-zA-Z0-9_-]{6,100}$/;

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedHostUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Please sign in first.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const reference = url.searchParams.get('reference')?.trim() || '';
    if (!REF_PATTERN.test(reference)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hosting payment reference.' },
        { status: 400 }
      );
    }

    const existing = await getHostingRequestByPaymentReference(reference);
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Hosting request not found.' },
        { status: 404 }
      );
    }

    if (existing.paymentStatus === 'paid') {
      return NextResponse.json({
        success: true,
        verified: true,
        request: existing,
      });
    }

    const cfg = await getPaystackConfig();
    if (!cfg.secretKey) {
      return NextResponse.json(
        { success: false, error: 'Paystack Secret Key is not configured.' },
        { status: 500 }
      );
    }

    const verification = await verifyPaystackTransaction({
      secretKey: cfg.secretKey,
      reference,
    });

    if (!verification.ok || !verification.data) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Could not verify Paystack payment.' },
        { status: 400 }
      );
    }

    const tx = verification.data;
    const expectedMinor = Math.round(existing.amount * 100);
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
          error: `Hosting payment was not completed (${tx.status || 'unverified'}).`,
        },
        { status: 400 }
      );
    }

    const result = await markHostingPaidByReference(reference);
    const finalRequest = result.request ?? existing;

    if (result.newlyPaid) {
      await notifyHostPaidToTelegram(finalRequest);
    }

    return NextResponse.json({
      success: true,
      verified: true,
      request: finalRequest,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify hosting payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
