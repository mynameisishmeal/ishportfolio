import { NextResponse } from 'next/server';
import {
  getOrderByPaymentReference,
  getPaystackConfig,
  markOrderPaidByReference,
} from '@/lib/store';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { notifyOrderToTelegram } from '@/lib/telegram';

const REF_PATTERN = /^[a-zA-Z0-9_-]{6,100}$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const reference = url.searchParams.get('reference')?.trim() || '';

    if (!REF_PATTERN.test(reference)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment reference.' },
        { status: 400 }
      );
    }

    const existing = await getOrderByPaymentReference(reference);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Order not found for this payment reference.' },
        { status: 404 }
      );
    }

    if (existing.paymentStatus === 'paid') {
      return NextResponse.json({
        success: true,
        verified: true,
        order: existing,
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
        { status: 400 }
      );
    }

    const result = await markOrderPaidByReference(reference);
    const finalOrder = result.order ?? existing;

    if (result.newlyPaid) {
      await notifyOrderToTelegram(finalOrder);
    }

    return NextResponse.json({
      success: true,
      verified: true,
      order: finalOrder,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify Paystack transaction';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
