'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatPrice, toSafeHttpUrl } from '@/lib/format';
import { HostingConfig, HostingRequest, HostingStatus } from '@/lib/types';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileArchive,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  Trash2,
} from 'lucide-react';

const STATUS_OPTIONS: { value: HostingStatus; label: string }[] = [
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'awaiting_upload', label: 'Paid (Awaiting ZIP)' },
  { value: 'submitted', label: 'ZIP Uploaded (Needs Attention)' },
  { value: 'in_review', label: 'Deploying / In Review' },
  { value: 'live', label: 'Live (Link Shared)' },
  { value: 'rejected', label: 'Needs Attention / Rejected' },
];

export default function HostRequestsManager() {
  const [requests, setRequests] = useState<HostingRequest[]>([]);
  const [config, setConfig] = useState<HostingConfig>({
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
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const [priceInput, setPriceInput] = useState('50000');
  const [redirectFeeInput, setRedirectFeeInput] = useState('15000');
  const [currencyCodeInput, setCurrencyCodeInput] = useState('NGN');
  const [currencySymbolInput, setCurrencySymbolInput] = useState('₦');
  const [badgeInput, setBadgeInput] = useState('Managed Hosting');
  const [titleInput, setTitleInput] = useState('Host Your Project ZIP');
  const [subtitleInput, setSubtitleInput] = useState(
    'Generate your unique access key, pay the one-time hosting fee, upload your .zip project folder, and receive your live link once deployed.'
  );
  const [supportedNoticeInput, setSupportedNoticeInput] = useState(
    'Only PHP and Node.js projects are supported for managed ZIP hosting.'
  );
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');

  const [drafts, setDrafts] = useState<
    Record<string, { liveUrl: string; adminNotes: string; hostingStatus: HostingStatus }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/admin/host', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Could not load hosting requests.');
        return;
      }
      setError('');
      const list: HostingRequest[] = Array.isArray(data.requests) ? data.requests : [];
      setRequests(list);
      if (data.config) {
        setConfig(data.config);
        if (!quiet) {
          setPriceInput(String(data.config.price ?? 50000));
          setRedirectFeeInput(String(data.config.redirectFee ?? 15000));
          setCurrencyCodeInput(data.config.currencyCode || 'NGN');
          setCurrencySymbolInput(data.config.currencySymbol || '₦');
          setBadgeInput(data.config.badge || 'Managed Hosting');
          setTitleInput(data.config.title || 'Host Your Project ZIP');
          setSubtitleInput(data.config.subtitle || '');
          setSupportedNoticeInput(
            data.config.supportedStacksNotice ||
              'Only PHP and Node.js projects are supported for managed ZIP hosting.'
          );
        }
      }
      setDrafts(prev => {
        const next = { ...prev };
        for (const r of list) {
          if (!next[r.id]) {
            next[r.id] = {
              liveUrl: r.liveUrl || '',
              adminNotes: r.adminNotes || '',
              hostingStatus: r.hostingStatus,
            };
          }
        }
        return next;
      });
    } catch {
      setError('Failed to connect to admin hosting API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
    const timer = window.setInterval(() => {
      void loadData(true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigMsg('');
    try {
      const res = await fetch('/api/admin/host', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: Number(priceInput),
          redirectFee: Number(redirectFeeInput),
          currencyCode: currencyCodeInput.trim().toUpperCase(),
          currencySymbol: currencySymbolInput.trim(),
          badge: badgeInput.trim(),
          title: titleInput.trim(),
          subtitle: subtitleInput.trim(),
          supportedStacksNotice: supportedNoticeInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setConfigMsg(data.error || 'Could not save hosting settings.');
      } else {
        setConfig(data.config);
        setConfigMsg('Hosting pricing and copy saved.');
      }
    } catch {
      setConfigMsg('Network error saving pricing.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleUpdateRequest = async (reqId: string) => {
    const draft = drafts[reqId];
    if (!draft) return;

    setSavingId(reqId);
    setError('');
    try {
      const nextStatus: HostingStatus =
        draft.liveUrl.trim() && draft.hostingStatus === 'submitted'
          ? 'live'
          : draft.hostingStatus;

      const res = await fetch(`/api/admin/host/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveUrl: draft.liveUrl.trim(),
          adminNotes: draft.adminNotes.trim(),
          hostingStatus: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data.request) {
        setError(data?.error || 'Could not update hosting deployment.');
        return;
      }

      const updated: HostingRequest = data.request;
      setRequests(prev => prev.map(r => (r.id === reqId ? updated : r)));
      setDrafts(prev => ({
        ...prev,
        [reqId]: {
          liveUrl: updated.liveUrl || '',
          adminNotes: updated.adminNotes || '',
          hostingStatus: updated.hostingStatus,
        },
      }));
    } catch {
      setError('Failed to save hosting deployment update.');
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmBankPayment = async (reqId: string) => {
    setSavingId(reqId);
    setError('');
    try {
      const res = await fetch(`/api/admin/host/${encodeURIComponent(reqId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'paid' }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data.request) {
        setError(data?.error || 'Could not confirm payment.');
        return;
      }

      const updated: HostingRequest = data.request;
      setRequests(prev => prev.map(r => (r.id === reqId ? updated : r)));
      setDrafts(prev => ({
        ...prev,
        [reqId]: {
          liveUrl: updated.liveUrl || '',
          adminNotes: updated.adminNotes || '',
          hostingStatus: updated.hostingStatus,
        },
      }));
    } catch {
      setError('Failed to confirm bank transfer payment.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (reqId: string) => {
    if (!confirm(`Delete hosting request ${reqId} and its uploaded ZIP?`)) return;
    const res = await fetch(`/api/admin/host/${encodeURIComponent(reqId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setRequests(prev => prev.filter(r => r.id !== reqId));
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Loading managed ZIP hosting requests...
      </div>
    );
  }

  const submittedCount = requests.filter(r => r.hostingStatus === 'submitted').length;

  return (
    <div className="space-y-6">
      {/* Header & Hosting Pricing Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Server className="h-5 w-5 text-amber-400" />
            Managed ZIP Hosting ({requests.length})
            {submittedCount > 0 ? (
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                {submittedCount} awaiting deployment
              </span>
            ) : null}
          </h2>
          <p className="text-xs text-zinc-400">
            Download user ZIP uploads, deploy their projects, and share their live URL directly back to their account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Hosting Pricing & Copy Editor */}
      <form
        onSubmit={handleSaveConfig}
        className="space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Hosting Fee
            </label>
            <input
              type="number"
              min={100}
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              aria-label="Hosting Fee"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Redirect Add-on Fee
            </label>
            <input
              type="number"
              min={0}
              value={redirectFeeInput}
              onChange={e => setRedirectFeeInput(e.target.value)}
              aria-label="Redirect Add-on Fee"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Currency Code
            </label>
            <input
              type="text"
              maxLength={5}
              value={currencyCodeInput}
              onChange={e => setCurrencyCodeInput(e.target.value)}
              aria-label="Currency Code"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs uppercase text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Symbol
            </label>
            <input
              type="text"
              maxLength={4}
              value={currencySymbolInput}
              onChange={e => setCurrencySymbolInput(e.target.value)}
              aria-label="Currency Symbol"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-2 py-2 text-center text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Section Label
            </label>
            <input
              type="text"
              value={badgeInput}
              onChange={e => setBadgeInput(e.target.value)}
              aria-label="Section Label"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Hosting Heading
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              aria-label="Hosting Heading"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Supported Stacks Notice (PHP / Node.js)
            </label>
            <input
              type="text"
              value={supportedNoticeInput}
              onChange={e => setSupportedNoticeInput(e.target.value)}
              aria-label="Supported Stacks Notice"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="mb-1 block text-[11px] font-medium text-zinc-400">
              Page Subtitle / Description
            </label>
            <input
              type="text"
              value={subtitleInput}
              onChange={e => setSubtitleInput(e.target.value)}
              aria-label="Page Subtitle"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          {configMsg ? (
            <span className="text-xs text-emerald-400">{configMsg}</span>
          ) : (
            <span className="text-[11px] text-zinc-500">
              All #host pricing and text above update live for visitors.
            </span>
          )}
          <button
            type="submit"
            disabled={savingConfig}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>
              {savingConfig
                ? 'Saving...'
                : `Save Hosting Settings (${formatPrice(
                    config.price,
                    config.currencySymbol,
                    config.currencyCode
                  )})`}
            </span>
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
          No hosting deployments yet. When a user signs up, pays {formatPrice(config.price, config.currencySymbol, config.currencyCode)}, and uploads a ZIP on #host, it will show up here.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by narration code (e.g. HBT-...), request ID, user, or project..."
              className="w-full rounded-xl border border-white/10 bg-zinc-950 py-2 pl-9 pr-3.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
            />
          </div>

          {requests
            .filter(reqItem => {
              const q = searchQuery.trim().toLowerCase();
              if (!q) return true;
              return (
                (reqItem.paymentReference || '').toLowerCase().includes(q) ||
                reqItem.id.toLowerCase().includes(q) ||
                reqItem.projectName.toLowerCase().includes(q) ||
                reqItem.userName.toLowerCase().includes(q) ||
                reqItem.userEmail.toLowerCase().includes(q) ||
                (reqItem.transferProof || '').toLowerCase().includes(q)
              );
            })
            .map(reqItem => {
            const draft = drafts[reqItem.id] || {
              liveUrl: reqItem.liveUrl || '',
              adminNotes: reqItem.adminNotes || '',
              hostingStatus: reqItem.hostingStatus,
            };
            const needsAction = reqItem.hostingStatus === 'submitted';

            return (
              <div
                key={reqItem.id}
                className={`rounded-2xl border p-5 space-y-4 ${
                  needsAction
                    ? 'border-amber-400/40 bg-amber-400/[0.04]'
                    : 'border-white/[0.08] bg-zinc-900/60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-code text-xs font-bold text-amber-300">
                        {reqItem.id}
                      </span>
                      <span className="font-display text-base font-bold text-white">
                        {reqItem.projectName}
                      </span>
                      {needsAction ? (
                        <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-zinc-950">
                          New ZIP Ready
                        </span>
                      ) : null}
                      {reqItem.redirectAddon ? (
                        <span className="rounded-full border border-amber-400/35 bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          Redirect (+
                          {formatPrice(
                            reqItem.redirectFee ?? 15000,
                            reqItem.currencySymbol,
                            reqItem.currencyCode
                          )}
                          )
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-300">
                      <span className="font-medium">{reqItem.userName}</span> · {reqItem.userEmail} ·{' '}
                      {reqItem.paymentMethod ? (
                        <span className="mr-1.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
                          {reqItem.paymentMethod}
                        </span>
                      ) : null}
                      <span
                        className={
                          reqItem.paymentStatus === 'paid'
                            ? 'font-semibold text-emerald-400'
                            : 'text-amber-300'
                        }
                      >
                        {reqItem.paymentStatus === 'paid'
                          ? `Paid ${formatPrice(
                              reqItem.amount,
                              reqItem.currencySymbol,
                              reqItem.currencyCode
                            )}`
                          : `Payment Pending (${formatPrice(
                              reqItem.amount,
                              reqItem.currencySymbol,
                              reqItem.currencyCode
                            )})`}
                      </span>
                    </p>
                    {reqItem.paymentReference ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                          <span>Narration Code:</span>
                          <span className="font-mono-code text-white">
                            {reqItem.paymentReference}
                          </span>
                        </span>
                        {reqItem.transferProof ? (
                          <span className="text-[11px] text-zinc-400">
                            Note: <span className="text-zinc-200">{reqItem.transferProof}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : reqItem.transferProof ? (
                      <p className="mt-1.5 inline-block rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                        Transfer Note: <span className="font-semibold">{reqItem.transferProof}</span>
                      </p>
                    ) : null}
                    {reqItem.redirectAddon && reqItem.redirectTargetUrl ? (
                      <p className="mt-1 text-xs text-amber-200/90">
                        Redirect Destination: {reqItem.redirectTargetUrl}
                      </p>
                    ) : null}
                    {reqItem.notes ? (
                      <p className="mt-1.5 text-xs text-zinc-400">User notes: {reqItem.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {reqItem.paymentStatus !== 'paid' ? (
                      <button
                        type="button"
                        onClick={() => void handleConfirmBankPayment(reqItem.id)}
                        disabled={savingId === reqItem.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          {savingId === reqItem.id
                            ? 'Confirming...'
                            : 'Confirm Payment & Unlock Upload'}
                        </span>
                      </button>
                    ) : null}
                    {reqItem.zipFileId ? (
                      <a
                        href={`/api/admin/host/${encodeURIComponent(reqItem.id)}/download`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/25"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download ZIP</span>
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleDelete(reqItem.id)}
                      aria-label={`Delete ${reqItem.id}`}
                      className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {reqItem.zipFileName ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-zinc-950/70 px-3.5 py-2 text-xs">
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

                {/* Admin Fulfillment: Live Link + Status + Notes */}
                <div className="grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Share Live Link (URL)
                    </label>
                    <input
                      type="url"
                      value={draft.liveUrl}
                      onChange={e =>
                        setDrafts(prev => ({
                          ...prev,
                          [reqItem.id]: { ...draft, liveUrl: e.target.value },
                        }))
                      }
                      placeholder="https://client-project.vercel.app"
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-400/60"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Deployment Status
                    </label>
                    <select
                      value={draft.hostingStatus}
                      onChange={e =>
                        setDrafts(prev => ({
                          ...prev,
                          [reqItem.id]: {
                            ...draft,
                            hostingStatus: e.target.value as HostingStatus,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-amber-400/60"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[11px] font-medium text-zinc-400">
                      Message / Note to User (optional)
                    </label>
                    <input
                      type="text"
                      value={draft.adminNotes}
                      onChange={e =>
                        setDrafts(prev => ({
                          ...prev,
                          [reqItem.id]: { ...draft, adminNotes: e.target.value },
                        }))
                      }
                      placeholder="Deployed cleanly with SSL..."
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-400/60"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {toSafeHttpUrl(reqItem.liveUrl) ? (
                    <a
                      href={toSafeHttpUrl(reqItem.liveUrl)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{reqItem.liveUrl}</span>
                    </a>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    disabled={savingId === reqItem.id}
                    onClick={() => void handleUpdateRequest(reqItem.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {savingId === reqItem.id ? 'Saving...' : 'Save & Share Link'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
