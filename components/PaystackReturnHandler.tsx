'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export default function PaystackReturnHandler() {
  const { clearCart, setCompletedOrder, refreshProducts, refreshAccount, goToPage } = useStore();
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyOk, setVerifyOk] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const hostRef = url.searchParams.get('host_ref');
    const shopRef = url.searchParams.get('paystack_ref') || url.searchParams.get('reference');

    // Handle Hosting Paystack return (?host_ref=HPSK-...) even when #host is not mounted yet
    if (hostRef && hostRef.startsWith('HPSK-')) {
      let active = true;
      setVerifying(true);
      setVerifyError('');
      setVerifyOk('');
      goToPage(3);

      (async () => {
        try {
          const res = await fetch(
            `/api/host/pay/verify?reference=${encodeURIComponent(hostRef)}`,
            { cache: 'no-store' }
          );
          const data = await res.json().catch(() => null);
          if (!active) return;

          url.searchParams.delete('host_ref');
          url.searchParams.delete('trxref');
          url.searchParams.delete('reference');
          window.history.replaceState(null, '', url.pathname + url.search + '#host');

          if (res.ok && data?.success && data?.verified) {
            setVerifyOk('Hosting payment confirmed! You can now upload your project .zip folder.');
            void refreshAccount();
            window.dispatchEvent(new Event('ish:host-updated'));
          } else {
            setVerifyError(data?.error || 'Could not confirm Paystack hosting payment.');
          }
        } catch {
          if (active) {
            setVerifyError('Network error while confirming hosting Paystack payment.');
          }
        } finally {
          if (active) setVerifying(false);
        }
      })();

      return () => {
        active = false;
      };
    }

    if (!shopRef || !shopRef.startsWith('PSK-')) return;

    let active = true;
    setVerifying(true);
    setVerifyError('');
    setVerifyOk('');

    (async () => {
      try {
        const res = await fetch(
          `/api/paystack/verify?reference=${encodeURIComponent(shopRef)}`,
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => null);
        if (!active) return;

        // Clean Paystack query parameters without disturbing hash route
        url.searchParams.delete('paystack_ref');
        url.searchParams.delete('trxref');
        url.searchParams.delete('reference');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);

        if (res.ok && data?.success && data?.verified && data?.order) {
          clearCart();
          setCompletedOrder(data.order);
          void refreshProducts();
          void refreshAccount();
        } else {
          setVerifyError(
            data?.error || 'Paystack payment was not completed. Your cart items are still saved.'
          );
        }
      } catch {
        if (active) {
          setVerifyError('Network error while confirming Paystack payment.');
        }
      } finally {
        if (active) setVerifying(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [clearCart, setCompletedOrder, refreshProducts, refreshAccount, goToPage]);

  if (!verifying && !verifyError && !verifyOk) return null;

  return (
    <div className="fixed bottom-16 left-4 z-50 max-w-sm rounded-2xl border border-white/15 bg-zinc-950/95 p-4 text-xs shadow-2xl backdrop-blur-xl sm:left-6">
      {verifying ? (
        <div className="flex items-center gap-2.5 text-zinc-200">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          <span>Confirming your Paystack payment...</span>
        </div>
      ) : verifyOk ? (
        <div className="flex items-start gap-2.5 text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="flex-1">{verifyOk}</div>
          <button
            type="button"
            onClick={() => setVerifyOk('')}
            aria-label="Dismiss payment confirmation"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div className="flex-1">{verifyError}</div>
          <button
            type="button"
            onClick={() => setVerifyError('')}
            aria-label="Dismiss payment notice"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
