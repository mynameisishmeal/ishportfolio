'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { formatPrice, generateNarrationCode } from '@/lib/format';
import { hostAuthHeaders } from '@/lib/host-client';
import { CartItem, Order } from '@/lib/types';
import AccessKeyAuthForm from './AccessKeyAuthForm';
import { Check, Copy, CreditCard, KeyRound, Landmark, RefreshCw } from 'lucide-react';

interface ShopCheckoutPanelProps {
  items: CartItem[];
  initialMethod?: 'Paystack' | 'Bank Transfer';
  onOrderCompleted?: (order: Order) => void;
}

export default function ShopCheckoutPanel({
  items,
  initialMethod,
  onOrderCompleted,
}: ShopCheckoutPanelProps) {
  const {
    profile,
    accountUser,
    paymentConfig,
    refreshAccount,
    refreshProducts,
    setCompletedOrder,
  } = useStore();

  const [paymentMethod, setPaymentMethod] = useState<'Paystack' | 'Bank Transfer'>(() => {
    if (paymentConfig.paystackEnabled && !paymentConfig.bankTransferEnabled) return 'Paystack';
    if (!paymentConfig.paystackEnabled && paymentConfig.bankTransferEnabled) return 'Bank Transfer';
    return initialMethod || 'Bank Transfer';
  });
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [narrationCode, setNarrationCode] = useState('');
  const [copiedNarration, setCopiedNarration] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setNarrationCode(prev => prev || generateNarrationCode('OBT'));
  }, []);

  useEffect(() => {
    if (paymentConfig.paystackEnabled && !paymentConfig.bankTransferEnabled) {
      setPaymentMethod('Paystack');
    } else if (!paymentConfig.paystackEnabled && paymentConfig.bankTransferEnabled) {
      setPaymentMethod('Bank Transfer');
    } else if (initialMethod) {
      setPaymentMethod(initialMethod);
    }
  }, [initialMethod, paymentConfig.paystackEnabled, paymentConfig.bankTransferEnabled]);

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const hasPhysical = items.some(item => item.product.type === 'physical');

  if (!accountUser) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200">
          Your unique Access Key links shop purchases, bank transfer narration codes, and Hosting
          together in one session.
        </div>
        <AccessKeyAuthForm
          compact
          createTitle="Create Access Key to Checkout"
          loginTitle="Sign In with Access Key"
          helperText="We remember your session for 90 days across Shop & Hosting."
        />
      </div>
    );
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payloadItems = items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      if (paymentMethod === 'Paystack') {
        const res = await fetch('/api/paystack/initialize', {
          method: 'POST',
          headers: hostAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            items: payloadItems,
            customerName: accountUser.name,
            customerEmail: accountUser.email,
            notes,
            website,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.authorizationUrl) {
          setErrorMsg(data.error || 'Unable to start Paystack checkout.');
        } else {
          window.location.href = data.authorizationUrl;
        }
        return;
      }

      const codeToSend = narrationCode || generateNarrationCode('OBT');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: hostAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          items: payloadItems,
          customerName: accountUser.name,
          customerEmail: accountUser.email,
          paymentMethod: 'Bank Transfer',
          paymentReference: codeToSend,
          notes,
          website,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        setErrorMsg(data.error || 'Unable to place order.');
      } else {
        setNotes('');
        setNarrationCode(generateNarrationCode('OBT'));
        onOrderCompleted?.(data.order);
        setCompletedOrder(data.order);
        await Promise.all([refreshProducts(), refreshAccount()]);
      }
    } catch {
      setErrorMsg('Network error placing order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedTotal = formatPrice(total, profile.currencySymbol, profile.currencyCode);
  const paystackReady = paymentConfig.paystackEnabled;
  const bankReady = paymentConfig.bankTransferEnabled;
  const neitherConfigured = !paystackReady && !bankReady;
  const showPaystackBtn = paystackReady || neitherConfigured;
  const showBankBtn = bankReady || neitherConfigured;
  const canPay = paymentMethod === 'Paystack' ? paystackReady : bankReady;

  return (
    <form onSubmit={handleCheckout} className="space-y-3.5">
      <div className="sr-only" aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={e => setWebsite(e.target.value)}
        />
      </div>

      {/* Unified Session Badge */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="truncate font-medium text-zinc-200">{accountUser.name}</span>
          <span className="hidden truncate text-zinc-500 sm:inline">({accountUser.email})</span>
        </div>
        <span className="font-mono-code shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          Key ••••-{accountUser.keyHint}
        </span>
      </div>

      {/* 2-Option Payment Switcher: Paystack | Bank Transfer */}
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-zinc-400">
          Choose Payment Method
        </label>
        <div
          className={`grid ${
            showPaystackBtn && showBankBtn ? 'grid-cols-2' : 'grid-cols-1'
          } gap-2 rounded-xl border border-white/10 bg-zinc-950 p-1`}
        >
          {showPaystackBtn && (
            <button
              type="button"
              disabled={!paystackReady}
              onClick={() => {
                setPaymentMethod('Paystack');
                setErrorMsg('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500 cursor-pointer ${
                paymentMethod === 'Paystack'
                  ? 'bg-amber-400 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>{paystackReady ? 'Paystack' : 'Disabled'}</span>
            </button>
          )}
          {showBankBtn && (
            <button
              type="button"
              disabled={!bankReady}
              onClick={() => {
                setPaymentMethod('Bank Transfer');
                setErrorMsg('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500 cursor-pointer ${
                paymentMethod === 'Bank Transfer'
                  ? 'bg-emerald-400 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              <span>{bankReady ? 'Bank Transfer' : 'Disabled'}</span>
            </button>
          )}
        </div>
      </div>

      {paymentMethod === 'Paystack' ? (
        <p
          className={`text-[11px] ${
            paymentConfig.paystackEnabled ? 'text-zinc-400' : 'text-amber-300'
          }`}
        >
          {paymentConfig.paystackEnabled
            ? 'You will be redirected securely to Paystack (Card / Bank / USSD) and automatically verified back here.'
            : 'Paystack is not active yet'}
        </p>
      ) : paymentConfig.bankTransferEnabled && paymentConfig.bankTransfer ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-emerald-300">
            <span className="inline-flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" />
              <span>Direct Bank Transfer Details</span>
            </span>
            <span className="font-mono-code text-white">{formattedTotal}</span>
          </div>
          <div className="text-zinc-200">
            <span className="text-zinc-400">Bank:</span> {paymentConfig.bankTransfer.bankName}
          </div>
          <div className="text-zinc-200">
            <span className="text-zinc-400">Account Name:</span>{' '}
            {paymentConfig.bankTransfer.accountName}
          </div>
          <div className="flex items-center justify-between gap-2 text-zinc-100">
            <span>
              <span className="text-zinc-400">Account No:</span>{' '}
              <span className="font-mono-code font-bold">
                {paymentConfig.bankTransfer.accountNumber}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(paymentConfig.bankTransfer!.accountNumber);
                setCopiedAccount(true);
                setTimeout(() => setCopiedAccount(false), 1800);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-zinc-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-zinc-950 cursor-pointer"
            >
              {copiedAccount ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          {paymentConfig.bankTransfer.instructions ? (
            <p className="text-zinc-300">{paymentConfig.bankTransfer.instructions}</p>
          ) : null}

          <div className="mt-1 rounded-lg border border-amber-400/35 bg-zinc-950/90 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-amber-300">
                Unique Narration Code (Add to Transfer)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!narrationCode) return;
                    navigator.clipboard?.writeText(narrationCode);
                    setCopiedNarration(true);
                    setTimeout(() => setCopiedNarration(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-amber-400/35 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/25 cursor-pointer"
                >
                  {copiedNarration ? (
                    <>
                      <Check className="h-2.5 w-2.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-2.5 w-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setNarrationCode(generateNarrationCode('OBT'))}
                  title="Generate another code"
                  className="inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10 cursor-pointer"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
            <div className="mt-1 font-mono-code text-sm font-bold tracking-wider text-white">
              {narrationCode || '...'}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-amber-300">
          Direct Bank Transfer is not active yet — configure bank details in Admin -&gt; Profile
          &amp; Settings.
        </p>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-medium text-zinc-400">
          {hasPhysical ? 'Shipping Address / Delivery Notes *' : 'Project or Order Notes (Optional)'}
        </label>
        <input
          type="text"
          required={hasPhysical}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={
            hasPhysical
              ? 'Delivery address and phone number...'
              : 'Any details or requirements...'
          }
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
        />
      </div>

      {errorMsg ? <p className="text-xs text-red-400">{errorMsg}</p> : null}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-medium text-zinc-400">Total</span>
        <span className="font-mono-code text-xl font-bold text-zinc-100">{formattedTotal}</span>
      </div>

      <button
        type="submit"
        disabled={submitting || !canPay}
        className={`w-full rounded-xl py-3 text-sm font-semibold text-zinc-950 transition disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer ${
          paymentMethod === 'Bank Transfer'
            ? 'bg-emerald-400 hover:bg-emerald-300'
            : 'bg-amber-400 hover:bg-amber-300'
        }`}
      >
        {!canPay
          ? 'Disabled'
          : submitting
            ? paymentMethod === 'Paystack'
              ? 'Redirecting to Paystack...'
              : 'Recording Order...'
            : paymentMethod === 'Paystack'
              ? `Pay ${formattedTotal} via Paystack`
              : `Submit Bank Transfer Order (${formattedTotal})`}
      </button>
    </form>
  );
}
