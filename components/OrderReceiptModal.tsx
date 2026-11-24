'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { formatPrice } from '@/lib/format';
import { CheckCircle2, X } from 'lucide-react';

export default function OrderReceiptModal() {
  const { completedOrder, setCompletedOrder } = useStore();

  if (!completedOrder) return null;

  return (
    <div
      onClick={() => setCompletedOrder(null)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 text-zinc-100 shadow-2xl"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCompletedOrder(null)}
            aria-label="Close order confirmation"
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="font-display mt-4 text-xl font-bold">
            {completedOrder.paymentStatus === 'paid' ? 'Payment Confirmed' : 'Order Received'}
          </h3>
          <p className="mt-1.5 text-sm text-zinc-400">
            Thank you, {completedOrder.customerName}. Your order has been recorded and confirmation details will be sent to{' '}
            <span className="text-zinc-200">{completedOrder.customerEmail}</span>.
          </p>
        </div>

        <div className="mt-6 space-y-2.5 rounded-xl border border-white/[0.08] bg-zinc-900/70 p-4 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-400">Order Reference</span>
            <span className="font-mono-code font-semibold text-amber-300">
              {completedOrder.id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Payment Method</span>
            <span className="text-zinc-200">{completedOrder.paymentMethod}</span>
          </div>
          {completedOrder.paymentReference ? (
            <div className="flex justify-between">
              <span className="text-zinc-400">
                {completedOrder.paymentMethod === 'Bank Transfer'
                  ? 'Narration Code'
                  : 'Transaction Ref'}
              </span>
              <span className="font-mono-code font-semibold text-amber-300">
                {completedOrder.paymentReference}
              </span>
            </div>
          ) : null}
          {completedOrder.paymentStatus === 'paid' ? (
            <div className="flex justify-between">
              <span className="text-zinc-400">Payment Status</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
                Paid
              </span>
            </div>
          ) : null}
          <div className="border-t border-white/[0.06] pt-2.5">
            {completedOrder.items.map(item => (
              <div key={item.productId} className="flex justify-between py-1 text-zinc-300">
                <span>
                  {item.title} × {item.quantity}
                </span>
                <span className="font-mono-code">
                  {formatPrice(
                    item.price * item.quantity,
                    completedOrder.currencySymbol,
                    completedOrder.currencyCode
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-white/[0.08] pt-2.5 text-sm font-bold text-zinc-100">
            <span>Total</span>
            <span className="font-mono-code">
              {formatPrice(
                completedOrder.total,
                completedOrder.currencySymbol,
                completedOrder.currencyCode
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCompletedOrder(null)}
          className="mt-5 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}
