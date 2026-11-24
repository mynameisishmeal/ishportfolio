'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { formatPrice, generateNarrationCode } from '@/lib/format';
import {
  HOST_CACHE_KEY,
  hostAuthHeaders,
  writeStoredHostToken,
} from '@/lib/host-client';
import { HostingRequest, HostingStatus, PublicHostUser } from '@/lib/types';
import AccessKeyAuthForm, { NewlyCreatedKeyBanner } from './AccessKeyAuthForm';
import MotionReveal from './MotionReveal';
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FileArchive,
  Landmark,
  LogOut,
  RefreshCw,
  Server,
  UploadCloud,
} from 'lucide-react';

interface BankTransferPublicConfig {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string;
}

interface HostingPublicConfig {
  price: number;
  redirectFee?: number;
  currencyCode: string;
  currencySymbol: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  supportedStacksNotice?: string;
  paystackEnabled: boolean;
  bankTransferEnabled?: boolean;
  bankTransfer?: BankTransferPublicConfig | null;
}

const DEFAULT_CFG: HostingPublicConfig = {
  price: 50000,
  redirectFee: 15000,
  currencyCode: 'NGN',
  currencySymbol: '₦',
  badge: 'Managed Hosting',
  title: 'Host Your Project ZIP',
  subtitle:
    'Generate your unique access key, pay the one-time hosting fee, upload your .zip project folder, and receive your live link once deployed.',
  supportedStacksNotice:
    'Only PHP and Node.js projects are supported for managed ZIP hosting.',
  paystackEnabled: false,
  bankTransferEnabled: false,
  bankTransfer: null,
};

const HOSTING_STATUS_BADGES: Record<
  HostingStatus,
  { label: string; className: string }
> = {
  awaiting_payment: {
    label: 'Awaiting Payment',
    className: 'border-zinc-700 bg-zinc-800/80 text-zinc-300',
  },
  awaiting_upload: {
    label: 'Paid — Ready for ZIP Upload',
    className: 'border-amber-400/35 bg-amber-400/15 text-amber-300',
  },
  submitted: {
    label: 'ZIP Uploaded — Pending',
    className: 'border-sky-400/35 bg-sky-400/15 text-sky-300',
  },
  in_review: {
    label: 'Deploying / In Review',
    className: 'border-indigo-400/35 bg-indigo-400/15 text-indigo-300',
  },
  live: {
    label: 'Live — Link Shared',
    className: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
  },
  rejected: {
    label: 'Needs Attention',
    className: 'border-red-500/35 bg-red-500/15 text-red-300',
  },
};

export default function HostSection() {
  const { accountUser, signOutAccount } = useStore();
  const [config, setConfig] = useState<HostingPublicConfig>(DEFAULT_CFG);
  const [user, setUser] = useState<PublicHostUser | null>(null);
  const [requests, setRequests] = useState<HostingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [website] = useState('');

  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [includeRedirect, setIncludeRedirect] = useState(false);
  const [payMethod, setPayMethod] = useState<'paystack' | 'bank'>('paystack');
  const [narrationCode, setNarrationCode] = useState('');
  const [copiedNarration, setCopiedNarration] = useState(false);
  const [transferProof, setTransferProof] = useState('');
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setNarrationCode(prev => prev || generateNarrationCode('HBT'));
  }, []);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [uploadMsg, setUploadMsg] = useState<
    Record<string, { type: 'ok' | 'err'; text: string }>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const syncCache = useCallback(
    (nextUser: PublicHostUser | null, nextReqs: HostingRequest[]) => {
      try {
        if (!nextUser) {
          localStorage.removeItem(HOST_CACHE_KEY);
        } else {
          localStorage.setItem(
            HOST_CACHE_KEY,
            JSON.stringify({ user: nextUser, requests: nextReqs })
          );
        }
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  const loadState = useCallback(async () => {
    try {
      const res = await fetch('/api/host/requests', {
        cache: 'no-store',
        headers: hostAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (data.config) {
          setConfig(data.config);
          if (!data.config.paystackEnabled && data.config.bankTransferEnabled) {
            setPayMethod(prev => (prev === 'paystack' ? 'bank' : prev));
          }
        }
        const nextUser = data.user || null;
        const nextReqs = Array.isArray(data.requests) ? data.requests : [];
        setUser(nextUser);
        setRequests(nextReqs);
        syncCache(nextUser, nextReqs);
        if (!nextUser) writeStoredHostToken(null);
      }
    } catch {
      // Keep cached display cleanly if offline transiently
    } finally {
      setLoading(false);
    }
  }, [syncCache]);

  // Hydrate cached workspace view immediately, then validate persistent 90-day session cookie
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOST_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          user?: PublicHostUser;
          requests?: HostingRequest[];
        };
        if (parsed.user?.id) {
          setUser(parsed.user);
          if (Array.isArray(parsed.requests)) setRequests(parsed.requests);
          setLoading(false);
        }
      }
    } catch {
      // Ignore cache read error
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [accountUser?.id, loadState]);

  // Verify Paystack return callback (?host_ref=HPSK-...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('host_ref');
    if (!ref || !ref.startsWith('HPSK-')) return;

    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/host/pay/verify?reference=${encodeURIComponent(ref)}`,
          { cache: 'no-store', headers: hostAuthHeaders() }
        );
        const data = await res.json();
        url.searchParams.delete('host_ref');
        url.searchParams.delete('trxref');
        url.searchParams.delete('reference');
        window.history.replaceState(null, '', url.pathname + url.search + '#host');

        if (!active) return;
        if (res.ok && data?.success && data?.verified) {
          setPayMsg({
            type: 'ok',
            text: 'Payment confirmed! Upload your project .zip folder below.',
          });
          void loadState();
        } else {
          setPayMsg({
            type: 'err',
            text: data?.error || 'Could not confirm Paystack payment.',
          });
        }
      } catch {
        if (active) {
          setPayMsg({ type: 'err', text: 'Network error confirming Paystack payment.' });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadState]);

  // Light poll when awaiting payment verification or admin review / link share
  useEffect(() => {
    if (!user) return;
    const hasActive = requests.some(
      r =>
        r.hostingStatus === 'submitted' ||
        r.hostingStatus === 'in_review' ||
        (r.hostingStatus === 'awaiting_payment' && r.paymentMethod === 'Bank Transfer')
    );
    if (!hasActive) return;

    const timer = window.setInterval(() => {
      void loadState();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [user, requests, loadState]);

  const handleLogout = async () => {
    await signOutAccount();
    setUser(null);
    setRequests([]);
    setPayMsg(null);
    syncCache(null, []);
  };

  const handleCopyBankAccount = async () => {
    const acct = config.bankTransfer?.accountNumber;
    if (!acct) return;
    try {
      await navigator.clipboard.writeText(acct);
      setCopiedBankAcc(true);
      window.setTimeout(() => setCopiedBankAcc(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyNarrationCode = async () => {
    if (!narrationCode) return;
    try {
      await navigator.clipboard.writeText(narrationCode);
      setCopiedNarration(true);
      window.setTimeout(() => setCopiedNarration(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handlePayToHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setPayMsg({ type: 'err', text: 'Please enter a project name first.' });
      return;
    }

    if (payMethod === 'bank') {
      const codeToSend = narrationCode || generateNarrationCode('HBT');
      setPaying(true);
      setPayMsg(null);
      try {
        const res = await fetch('/api/host/bank', {
          method: 'POST',
          headers: hostAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            projectName: projectName.trim(),
            notes: notes.trim(),
            includeRedirect,
            narrationCode: codeToSend,
            transferProof: transferProof.trim(),
            website,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          setPayMsg({
            type: 'err',
            text: data?.error || 'Could not submit bank transfer confirmation.',
          });
        } else {
          const submittedCode = data.request?.paymentReference || codeToSend;
          setProjectName('');
          setNotes('');
          setTransferProof('');
          setIncludeRedirect(false);
          setNarrationCode(generateNarrationCode('HBT'));
          setPayMsg({
            type: 'ok',
            text: `Bank transfer logged with narration code ${submittedCode}. Admin will verify and unlock your ZIP upload.`,
          });
          await loadState();
        }
      } catch {
        setPayMsg({ type: 'err', text: 'Network error submitting bank transfer.' });
      } finally {
        setPaying(false);
      }
      return;
    }

    setPaying(true);
    setPayMsg(null);
    try {
      const res = await fetch('/api/host/pay/initialize', {
        method: 'POST',
        headers: hostAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          projectName: projectName.trim(),
          notes: notes.trim(),
          includeRedirect,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.authorizationUrl) {
        setPayMsg({ type: 'err', text: data?.error || 'Could not start Paystack checkout.' });
      } else {
        window.location.href = data.authorizationUrl;
      }
    } catch {
      setPayMsg({ type: 'err', text: 'Network error starting Paystack payment.' });
    } finally {
      setPaying(false);
    }
  };

  const handleUploadZip = async (e: React.FormEvent, reqItem: HostingRequest) => {
    e.preventDefault();
    const file = selectedFiles[reqItem.id];
    if (!file) {
      setUploadMsg(prev => ({
        ...prev,
        [reqItem.id]: { type: 'err', text: 'Please pick a .zip archive file.' },
      }));
      return;
    }

    setUploadingId(reqItem.id);
    setUploadMsg(prev => {
      const copy = { ...prev };
      delete copy[reqItem.id];
      return copy;
    });

    try {
      const fd = new FormData();
      fd.append('requestId', reqItem.id);
      fd.append('projectName', reqItem.projectName);
      fd.append('notes', reqItem.notes || '');
      fd.append('file', file);

      const res = await fetch('/api/host/upload', {
        method: 'POST',
        headers: hostAuthHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setUploadMsg(prev => ({
          ...prev,
          [reqItem.id]: { type: 'err', text: data?.error || 'Upload failed.' },
        }));
      } else {
        setSelectedFiles(prev => ({ ...prev, [reqItem.id]: null }));
        setUploadMsg(prev => ({
          ...prev,
          [reqItem.id]: {
            type: 'ok',
            text: 'ZIP uploaded! Admin has been notified and will share your live link here shortly.',
          },
        }));
        await loadState();
      }
    } catch {
      setUploadMsg(prev => ({
        ...prev,
        [reqItem.id]: { type: 'err', text: 'Network error uploading ZIP.' },
      }));
    } finally {
      setUploadingId(null);
    }
  };

  const handleCopyUrl = async (id: string, liveUrl: string) => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const baseFee = Number(config.price) || 50000;
  const redirectAddonFee = Number(config.redirectFee ?? 15000);
  const totalFee = baseFee + (includeRedirect ? redirectAddonFee : 0);

  const formattedFee = formatPrice(
    baseFee,
    config.currencySymbol,
    config.currencyCode
  );
  const formattedRedirectFee = formatPrice(
    redirectAddonFee,
    config.currencySymbol,
    config.currencyCode
  );
  const formattedTotalFee = formatPrice(
    totalFee,
    config.currencySymbol,
    config.currencyCode
  );

  return (
    <section id="host" className="overflow-x-clip px-6 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <MotionReveal mode="mount">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono-code mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-300">
                <Server className="h-3.5 w-3.5" />
                <span>{config.badge || 'Managed Hosting'}</span>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                {config.title || 'Host Your Project ZIP'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
                {config.subtitle ||
                  'Generate your unique access key, pay the one-time hosting fee, upload your .zip project folder, and receive your live link once deployed.'}
              </p>
              {config.supportedStacksNotice ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 text-xs font-medium text-amber-200">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>{config.supportedStacksNotice}</span>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-right self-start sm:self-auto">
              <div className="text-[11px] uppercase tracking-wider text-amber-200/80">
                Hosting Fee
              </div>
              <div className="font-mono-code text-xl font-bold text-amber-300">
                {formattedFee}
              </div>
            </div>
          </div>
        </MotionReveal>

        {/* Newly Generated Unique Key Banner */}
        <div className="mt-6">
          <NewlyCreatedKeyBanner />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: How It Works + Signed-in Payment Card */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-6">
              <h3 className="font-display text-base font-bold text-zinc-100">
                How Hosting Works
              </h3>
              <ol className="mt-4 space-y-3 text-xs text-zinc-300">
                <li className="flex items-start gap-3">
                  <span className="font-mono-code flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-300">
                    1
                  </span>
                  <span>
                    Generate your unique access key (stored automatically so you stay logged in).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono-code flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-300">
                    2
                  </span>
                  <span>
                    Pay <strong className="text-zinc-100">{formattedFee}</strong> via Paystack to unlock
                    your hosting upload slot.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono-code flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-300">
                    3
                  </span>
                  <span>
                    Upload your <code className="text-amber-200">.zip</code> project folder (up to 50
                    MB). Admin receives an instant notification.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono-code flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[11px] font-bold text-amber-300">
                    4
                  </span>
                  <span>
                    Admin deploys your build and posts your live hosted URL right into your slot
                    card.
                  </span>
                </li>
              </ol>
            </div>

            {user ? (
              <form
                onSubmit={handlePayToHost}
                className="rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-6 space-y-4"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">{user.name}</div>
                    <div className="truncate text-xs text-zinc-400">
                      {user.email} ·{' '}
                      <span className="font-mono-code text-amber-300/90">
                        Key ••••-{user.keyHint}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>

                <div>
                  <h4 className="font-display text-sm font-bold text-zinc-100">
                    Start a New Hosting Deployment
                  </h4>
                  <p className="mt-1 text-xs text-zinc-400">
                    Pay {formattedFee} via Paystack or Direct Bank Transfer to unlock a ZIP upload
                    slot.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="e.g. Storefront Web App"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Setup / Environment Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Framework, custom domain notes, or build instructions..."
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                </div>

                {/* Optional Redirect Add-on Checkbox */}
                <label className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-zinc-950/70 p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRedirect}
                    onChange={e => setIncludeRedirect(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-100">
                        Add Link Redirect
                      </span>
                      <span className="font-mono-code rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                        +{formattedRedirectFee}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      Optional custom link redirect setup for your hosted project URL.
                    </p>
                  </div>
                </label>

                {includeRedirect ? (
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      {formattedFee} hosting + {formattedRedirectFee} redirect
                    </span>
                    <span className="font-mono-code font-bold text-amber-300">
                      Total: {formattedTotalFee}
                    </span>
                  </div>
                ) : null}

                {/* Payment Method Switcher */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-zinc-950 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPayMethod('paystack');
                        setPayMsg(null);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                        payMethod === 'paystack'
                          ? 'bg-amber-400 text-zinc-950'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Paystack</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayMethod('bank');
                        setPayMsg(null);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                        payMethod === 'bank'
                          ? 'bg-emerald-400 text-zinc-950'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      <span>Bank Transfer</span>
                    </button>
                  </div>
                </div>

                {payMethod === 'paystack' ? (
                  !config.paystackEnabled ? (
                    <p className="text-xs text-amber-300">
                      Paystack keys are not active yet — use Direct Bank Transfer or configure
                      Paystack in Admin -&gt; Profile &amp; Settings.
                    </p>
                  ) : null
                ) : config.bankTransferEnabled && config.bankTransfer ? (
                  <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-300">
                        Transfer Exactly {formattedTotalFee}
                      </span>
                      <span className="font-mono-code text-[11px] text-emerald-200/80">
                        Manual Verification
                      </span>
                    </div>
                    <div className="space-y-1 text-zinc-200">
                      <div>
                        <span className="text-zinc-400">Bank:</span>{' '}
                        <span className="font-medium">{config.bankTransfer.bankName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Account Name:</span>{' '}
                        <span className="font-medium">{config.bankTransfer.accountName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          <span className="text-zinc-400">Account No:</span>{' '}
                          <span className="font-mono-code font-bold text-white">
                            {config.bankTransfer.accountNumber}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyBankAccount()}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-zinc-950/60 px-2 py-1 text-[11px] font-medium text-emerald-200 hover:bg-zinc-950 cursor-pointer"
                        >
                          {copiedBankAcc ? (
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
                      {config.bankTransfer.instructions ? (
                        <p className="pt-1 text-[11px] text-zinc-300">
                          {config.bankTransfer.instructions}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-amber-400/35 bg-zinc-950/90 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-amber-300">
                          Unique Narration Code (Add to Transfer Remarks)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleCopyNarrationCode()}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/25 cursor-pointer"
                          >
                            {copiedNarration ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setNarrationCode(generateNarrationCode('HBT'))}
                            title="Generate another code"
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/10 cursor-pointer"
                          >
                            <RefreshCw className="h-2.5 w-2.5" />
                            <span>New</span>
                          </button>
                        </div>
                      </div>
                      <div className="mt-1.5 font-mono-code text-base font-bold tracking-wider text-white">
                        {narrationCode || '...'}
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        Paste this exact code into your bank transfer narration so admin can match
                        your payment immediately.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-emerald-200">
                        Sender Name / Bank Note (optional)
                      </label>
                      <input
                        type="text"
                        value={transferProof}
                        onChange={e => setTransferProof(e.target.value)}
                        placeholder="Optional — e.g. sent from Jane's GTBank"
                        className="w-full rounded-lg border border-emerald-400/30 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-300">
                    Direct Bank Transfer is not active yet — configure bank details in Admin -&gt;
                    Profile &amp; Settings.
                  </p>
                )}

                {payMsg ? (
                  <p
                    className={`text-xs ${
                      payMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {payMsg.text}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    paying ||
                    (payMethod === 'paystack'
                      ? !config.paystackEnabled
                      : !config.bankTransferEnabled)
                  }
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer ${
                    payMethod === 'bank'
                      ? 'bg-emerald-400 hover:bg-emerald-300'
                      : 'bg-amber-400 hover:bg-amber-300'
                  }`}
                >
                  {payMethod === 'bank' ? (
                    <Landmark className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  <span>
                    {paying
                      ? payMethod === 'bank'
                        ? 'Submitting Bank Transfer...'
                        : 'Redirecting to Paystack...'
                      : payMethod === 'bank'
                        ? `Submit Bank Transfer (${formattedTotalFee})`
                        : `Pay ${formattedTotalFee} via Paystack`}
                  </span>
                </button>
              </form>
            ) : null}
          </div>

          {/* Right: Key Generator / Key Login Card OR Paid Slots + ZIP Upload + Shared Link */}
          <div className="lg:col-span-7">
            {loading ? (
              <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/45 p-10 text-center text-sm text-zinc-400">
                Loading hosting workspace...
              </div>
            ) : !user ? (
              <AccessKeyAuthForm onAuthenticated={() => void loadState()} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-zinc-100">
                    Your Hosting Deployments ({requests.length})
                  </h3>
                </div>

                {requests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/35 p-10 text-center">
                    <FileArchive className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="mt-3 text-sm font-medium text-zinc-300">
                      No hosting slots yet.
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Complete the {formattedFee} payment via Paystack or Bank Transfer on the left
                      to unlock ZIP upload.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map(reqItem => {
                      const badge =
                        HOSTING_STATUS_BADGES[reqItem.hostingStatus] ||
                        HOSTING_STATUS_BADGES.awaiting_payment;
                      const canUpload =
                        reqItem.paymentStatus === 'paid' && reqItem.hostingStatus !== 'live';
                      const msg = uploadMsg[reqItem.id];

                      return (
                        <div
                          key={reqItem.id}
                          className="rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-6 space-y-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-display text-base font-bold text-zinc-100">
                                  {reqItem.projectName}
                                </h4>
                                <span className="font-mono-code text-[11px] text-zinc-500">
                                  {reqItem.id}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-400">
                                Fee:{' '}
                                {formatPrice(
                                  reqItem.amount,
                                  reqItem.currencySymbol,
                                  reqItem.currencyCode
                                )}{' '}
                                {reqItem.paymentMethod ? (
                                  <span className="mr-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
                                    {reqItem.paymentMethod}
                                  </span>
                                ) : null}
                                · Payment:{' '}
                                <span
                                  className={
                                    reqItem.paymentStatus === 'paid'
                                      ? 'font-semibold text-emerald-400'
                                      : 'text-amber-300'
                                  }
                                >
                                  {reqItem.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                                </span>
                                {reqItem.redirectAddon ? (
                                  <span className="ml-2 inline-flex items-center rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                    + Link Redirect
                                  </span>
                                ) : null}
                              </p>
                              {reqItem.paymentMethod === 'Bank Transfer' && reqItem.paymentStatus !== 'paid' ? (
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                                  <div>
                                    <div>
                                      Narration Code:{' '}
                                      <span className="font-mono-code font-bold text-white">
                                        {reqItem.paymentReference}
                                      </span>
                                    </div>
                                    <div className="text-amber-200/80">
                                      Waiting for admin to match this code and unlock ZIP upload.
                                    </div>
                                  </div>
                                  {reqItem.paymentReference ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(reqItem.paymentReference!);
                                        setCopiedId(`${reqItem.id}-nar`);
                                        window.setTimeout(() => setCopiedId(null), 1800);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-400/35 bg-zinc-950/60 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:bg-zinc-950 cursor-pointer"
                                    >
                                      {copiedId === `${reqItem.id}-nar` ? (
                                        <>
                                          <Check className="h-3 w-3" />
                                          <span>Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3 w-3" />
                                          <span>Copy Code</span>
                                        </>
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                              {reqItem.redirectAddon && reqItem.redirectTargetUrl ? (
                                <p className="mt-1 truncate text-[11px] text-zinc-400">
                                  Redirect target: {reqItem.redirectTargetUrl}
                                </p>
                              ) : null}
                            </div>

                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          {reqItem.zipFileName ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-zinc-950/70 px-4 py-2.5 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileArchive className="h-4 w-4 shrink-0 text-amber-300" />
                                <span className="truncate font-mono-code text-zinc-200">
                                  {reqItem.zipFileName}
                                </span>
                              </div>
                              {reqItem.zipSizeBytes ? (
                                <span className="shrink-0 font-mono-code text-zinc-500">
                                  {(reqItem.zipSizeBytes / (1024 * 1024)).toFixed(2)} MB
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {reqItem.liveUrl ? (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Your Hosted Project Link Is Live</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <a
                                  href={reqItem.liveUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-300"
                                >
                                  <span>Open Live Site</span>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void handleCopyUrl(reqItem.id, reqItem.liveUrl!)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-zinc-950 cursor-pointer"
                                >
                                  {copiedId === reqItem.id ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" />
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>
                                <span className="truncate font-mono-code text-xs text-emerald-200/90">
                                  {reqItem.liveUrl}
                                </span>
                              </div>
                              {reqItem.adminNotes ? (
                                <p className="mt-2.5 text-xs text-zinc-300">{reqItem.adminNotes}</p>
                              ) : null}
                            </div>
                          ) : reqItem.adminNotes ? (
                            <p className="rounded-xl border border-white/[0.06] bg-zinc-950/60 p-3 text-xs text-zinc-300">
                              <span className="font-semibold text-zinc-200">Admin note:</span>{' '}
                              {reqItem.adminNotes}
                            </p>
                          ) : null}

                          {canUpload ? (
                            <form
                              onSubmit={e => void handleUploadZip(e, reqItem)}
                              className="space-y-3 rounded-xl border border-dashed border-amber-400/30 bg-zinc-950/60 p-4"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-zinc-200">
                                  {reqItem.zipFileName
                                    ? 'Replace ZIP Archive (.zip)'
                                    : 'Upload Project ZIP Folder (.zip, max 50 MB)'}
                                </label>
                              </div>
                              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                                <input
                                  type="file"
                                  accept=".zip,application/zip,application/x-zip-compressed"
                                  onChange={e =>
                                    setSelectedFiles(prev => ({
                                      ...prev,
                                      [reqItem.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                  className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-200 hover:file:bg-zinc-800 cursor-pointer"
                                />
                                <button
                                  type="submit"
                                  disabled={uploadingId === reqItem.id}
                                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
                                >
                                  <UploadCloud className="h-3.5 w-3.5" />
                                  <span>
                                    {uploadingId === reqItem.id ? 'Uploading...' : 'Upload ZIP'}
                                  </span>
                                </button>
                              </div>
                              {msg ? (
                                <p
                                  className={`text-xs ${
                                    msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {msg.text}
                                </p>
                              ) : null}
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
