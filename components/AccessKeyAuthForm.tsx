'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { Check, Copy, KeyRound } from 'lucide-react';

export function NewlyCreatedKeyBanner() {
  const { newlyCreatedKey, clearNewlyCreatedKey } = useStore();
  const [copied, setCopied] = useState(false);

  if (!newlyCreatedKey) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <KeyRound className="h-4 w-4" />
            <span>Save Your Unique Access Key</span>
          </div>
          <p className="mt-1 text-xs text-zinc-300">
            Your device session stays signed in for 90 days across both Shop &amp; Hosting. Save
            this key to log in from any other browser or device.
          </p>
          <div className="font-mono-code mt-2.5 inline-block rounded-xl border border-amber-400/35 bg-zinc-950 px-4 py-2 text-base font-bold tracking-wider text-amber-200">
            {newlyCreatedKey}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Key</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={clearNewlyCreatedKey}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccessKeyAuthFormProps {
  compact?: boolean;
  createTitle?: string;
  loginTitle?: string;
  helperText?: string;
  onAuthenticated?: () => void;
}

export default function AccessKeyAuthForm({
  compact = false,
  createTitle = 'Create Your Unique Access Key',
  loginTitle = 'Login with Access Key',
  helperText = 'No password needed — we generate a unique access key shared across Shop & Hosting and remember your session on this device.',
  onAuthenticated,
}: AccessKeyAuthFormProps) {
  const { applyAuthSession } = useStore();

  const [authMode, setAuthMode] = useState<'create' | 'login'>('create');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [website, setWebsite] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint =
        authMode === 'create' ? '/api/host/auth/register' : '/api/host/auth/login';
      const payload =
        authMode === 'create'
          ? { name: authName, email: authEmail, website }
          : { accessKey: accessKeyInput };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setAuthError(data?.error || 'Authentication failed.');
      } else {
        await applyAuthSession({
          user: data.user,
          accessKey: authMode === 'create' ? data.accessKey : undefined,
        });
        setAccessKeyInput('');
        setAuthName('');
        setAuthEmail('');
        onAuthenticated?.();
      }
    } catch {
      setAuthError('Network error during authentication.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4'
          : 'rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-6 sm:p-8'
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-300" />
          <h3 className={`font-display font-bold text-zinc-100 ${compact ? 'text-sm' : 'text-lg'}`}>
            {authMode === 'create' ? createTitle : loginTitle}
          </h3>
        </div>

        <div className="inline-flex rounded-xl border border-white/10 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('create');
              setAuthError('');
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
              authMode === 'create'
                ? 'bg-amber-400 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Create Key
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setAuthError('');
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
              authMode === 'login'
                ? 'bg-amber-400 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Login with Key
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
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

        {authMode === 'create' ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Name (optional)
              </label>
              <input
                type="text"
                value={authName}
                onChange={e => setAuthName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-300">
                Email Address (for payment receipts &amp; order updates) *
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
            </div>
            <p className="text-[11px] text-zinc-400">{helperText}</p>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">
              Your Unique Access Key
            </label>
            <input
              type="text"
              required
              value={accessKeyInput}
              onChange={e => setAccessKeyInput(e.target.value)}
              placeholder="ISH-XXXX-XXXX-XXXX-XXXX"
              className="font-mono-code w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs sm:text-sm uppercase tracking-wider text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
            />
          </div>
        )}

        {authError ? <p className="text-xs text-red-400">{authError}</p> : null}

        <button
          type="submit"
          disabled={authLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
        >
          <KeyRound className="h-4 w-4" />
          <span>
            {authLoading
              ? 'Please wait...'
              : authMode === 'create'
                ? 'Generate Unique Access Key'
                : 'Unlock Workspace'}
          </span>
        </button>
      </form>
    </div>
  );
}
