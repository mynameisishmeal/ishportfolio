import { NextResponse } from 'next/server';
import {
  getHostingRequestByPaymentReference,
  getOrderByPaymentReference,
  getPaystackConfig,
  markHostingPaidByReference,
  markOrderPaidByReference,
} from '@/lib/store';
import { verifyPaystackWebhookSignature } from '@/lib/paystack';
import { notifyHostPaidToTelegram, notifyOrderToTelegram } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const cfg = await getPaystackConfig();

    if (!cfg.secretKey || !verifyPaystackWebhookSignature(rawBody, signature, cfg.secretKey)) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string; amount?: number; currency?: string; status?: string };
    };

    if (event.event === 'charge.success' && event.data?.reference) {
      const reference = String(event.data.reference).trim();

      if (reference.startsWith('HPSK-')) {
        const hostReq = await getHostingRequestByPaymentReference(reference);
        if (hostReq) {
          const expectedMinor = Math.round(hostReq.amount * 100);
          const currencyMatches =
            String(event.data.currency || '').toUpperCase() ===
            (hostReq.currencyCode || 'NGN').toUpperCase();
          if (
            event.data.status === 'success' &&
            Number(event.data.amount || 0) >= expectedMinor &&
            currencyMatches
          ) {
            const { request: updatedReq, newlyPaid } = await markHostingPaidByReference(reference);
            if (newlyPaid && updatedReq) {
              await notifyHostPaidToTelegram(updatedReq);
            }
          }
        }
      } else {
        const existing = await getOrderByPaymentReference(reference);
        if (existing) {
          const expectedMinor = Math.round(existing.total * 100);
          const currencyMatches =
            String(event.data.currency || '').toUpperCase() ===
            (existing.currencyCode || 'NGN').toUpperCase();
          if (
            event.data.status === 'success' &&
            Number(event.data.amount || 0) >= expectedMinor &&
            currencyMatches
          ) {
            const { order, newlyPaid } = await markOrderPaidByReference(reference);
            if (newlyPaid && order) {
              await notifyOrderToTelegram(order);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
