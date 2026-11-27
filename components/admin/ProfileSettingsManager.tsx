'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { FONT_SCALE_OPTIONS, normalizeFontScale } from '@/lib/format';
import { FontScale } from '@/lib/types';
import { CreditCard, Eye, EyeOff, KeyRound, Landmark, Save, Send } from 'lucide-react';

const CURRENCY_PRESETS = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'NGN', symbol: '₦', label: 'NGN (₦)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
];

export default function ProfileSettingsManager() {
  const { profile, refreshProfile, resetFontScale } = useStore();

  const [name, setName] = useState(profile.name);
  const [brandTitle, setBrandTitle] = useState(profile.brandTitle);
  const [role, setRole] = useState(profile.role);
  const [headline, setHeadline] = useState(profile.headline);
  const [bio, setBio] = useState(profile.bio);
  const [aboutText, setAboutText] = useState(profile.aboutText);
  const [location, setLocation] = useState(profile.location);
  const [availability, setAvailability] = useState(profile.availability);
  const [email, setEmail] = useState(profile.email);
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl);
  const [telegramHandle, setTelegramHandle] = useState(profile.telegramHandle || '');
  const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [announcement, setAnnouncement] = useState(profile.announcement || '');
  const [currencyCode, setCurrencyCode] = useState(profile.currencyCode || 'USD');
  const [currencySymbol, setCurrencySymbol] = useState(profile.currencySymbol || '$');
  const [fontScale, setAdminFontScale] = useState<FontScale>(normalizeFontScale(profile.fontScale));

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgHasToken, setTgHasToken] = useState(false);
  const [tgMaskedToken, setTgMaskedToken] = useState('');
  const [tgShowToken, setTgShowToken] = useState(false);
  const [tgChatId, setTgChatId] = useState('');
  const [tgNotifyContact, setTgNotifyContact] = useState(true);
  const [tgNotifyChat, setTgNotifyChat] = useState(true);
  const [tgNotifyOrders, setTgNotifyOrders] = useState(true);
  const [tgLoading, setTgLoading] = useState(true);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgMsg, setTgMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [psEnabled, setPsEnabled] = useState(false);
  const [psPublicKey, setPsPublicKey] = useState('');
  const [psSecretKey, setPsSecretKey] = useState('');
  const [psHasSecret, setPsHasSecret] = useState(false);
  const [psMaskedSecret, setPsMaskedSecret] = useState('');
  const [psShowSecret, setPsShowSecret] = useState(false);
  const [psLoading, setPsLoading] = useState(true);
  const [psSaving, setPsSaving] = useState(false);
  const [psMsg, setPsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [btEnabled, setBtEnabled] = useState(false);
  const [btBankName, setBtBankName] = useState('');
  const [btAccountName, setBtAccountName] = useState('');
  const [btAccountNumber, setBtAccountNumber] = useState('');
  const [btInstructions, setBtInstructions] = useState('');
  const [btLoading, setBtLoading] = useState(true);
  const [btSaving, setBtSaving] = useState(false);
  const [btMsg, setBtMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [tgRes, psRes, btRes] = await Promise.all([
          fetch('/api/admin/telegram', { cache: 'no-store' }),
          fetch('/api/admin/paystack', { cache: 'no-store' }),
          fetch('/api/admin/bank', { cache: 'no-store' }),
        ]);
        const [tgData, psData, btData] = await Promise.all([
          tgRes.json().catch(() => null),
          psRes.json().catch(() => null),
          btRes.json().catch(() => null),
        ]);
        if (!active) return;

        if (tgRes.ok && tgData?.success && tgData.telegram) {
          setTgEnabled(Boolean(tgData.telegram.enabled));
          setTgChatId(tgData.telegram.chatId || '');
          setTgHasToken(Boolean(tgData.telegram.hasBotToken));
          setTgMaskedToken(tgData.telegram.maskedToken || '');
          setTgNotifyContact(tgData.telegram.notifyContact !== false);
          setTgNotifyChat(tgData.telegram.notifyChat !== false);
          setTgNotifyOrders(tgData.telegram.notifyOrders !== false);
        }
        if (psRes.ok && psData?.success && psData.paystack) {
          setPsEnabled(Boolean(psData.paystack.enabled));
          setPsPublicKey(psData.paystack.publicKey || '');
          setPsHasSecret(Boolean(psData.paystack.hasSecretKey));
          setPsMaskedSecret(psData.paystack.maskedSecretKey || '');
        }
        if (btRes.ok && btData?.success && btData.bank) {
          setBtEnabled(Boolean(btData.bank.enabled));
          setBtBankName(btData.bank.bankName || '');
          setBtAccountName(btData.bank.accountName || '');
          setBtAccountNumber(btData.bank.accountNumber || '');
          setBtInstructions(btData.bank.instructions || '');
        }
      } catch {
        // Ignore transient load error
      } finally {
        if (active) {
          setTgLoading(false);
          setPsLoading(false);
          setBtLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setName(profile.name);
    setBrandTitle(profile.brandTitle);
    setRole(profile.role);
    setHeadline(profile.headline);
    setBio(profile.bio);
    setAboutText(profile.aboutText);
    setLocation(profile.location);
    setAvailability(profile.availability);
    setEmail(profile.email);
    setGithubUrl(profile.githubUrl);
    setTelegramHandle(profile.telegramHandle || '');
    setSkillsText(profile.skills.join(', '));
    setAnnouncement(profile.announcement || '');
    setCurrencyCode(profile.currencyCode || 'USD');
    setCurrencySymbol(profile.currencySymbol || '$');
    setAdminFontScale(normalizeFontScale(profile.fontScale));
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          brandTitle,
          role,
          headline,
          bio,
          aboutText,
          location,
          availability,
          email,
          githubUrl,
          telegramHandle,
          announcement,
          currencyCode,
          currencySymbol,
          fontScale,
          skills: skillsText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileMsg({ type: 'err', text: data.error || 'Failed to save profile.' });
      } else {
        resetFontScale();
        await refreshProfile();
        setProfileMsg({ type: 'ok', text: 'Site profile and settings saved.' });
      }
    } catch {
      setProfileMsg({ type: 'err', text: 'Network error saving profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setTgSaving(true);
    setTgMsg(null);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: tgEnabled,
          botToken: tgBotToken.trim(),
          chatId: tgChatId.trim(),
          notifyContact: tgNotifyContact,
          notifyChat: tgNotifyChat,
          notifyOrders: tgNotifyOrders,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTgMsg({ type: 'err', text: data.error || 'Failed to save Telegram configuration.' });
      } else {
        setTgBotToken('');
        setTgHasToken(Boolean(data.telegram?.hasBotToken));
        setTgMaskedToken(data.telegram?.maskedToken || '');
        setTgMsg({ type: 'ok', text: 'Telegram forwarding settings saved.' });
      }
    } catch {
      setTgMsg({ type: 'err', text: 'Network error saving Telegram configuration.' });
    } finally {
      setTgSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTgTesting(true);
    setTgMsg(null);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgBotToken.trim(),
          chatId: tgChatId.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTgMsg({ type: 'err', text: data.error || 'Could not send test message.' });
      } else {
        setTgMsg({ type: 'ok', text: 'Test message delivered to Telegram.' });
      }
    } catch {
      setTgMsg({ type: 'err', text: 'Network error testing Telegram.' });
    } finally {
      setTgTesting(false);
    }
  };

  const handleClearTelegramToken = async () => {
    setTgSaving(true);
    setTgMsg(null);
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearToken: true, enabled: false }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTgBotToken('');
        setTgHasToken(false);
        setTgMaskedToken('');
        setTgEnabled(false);
        setTgMsg({ type: 'ok', text: 'Saved Bot Token cleared and notifications disabled.' });
      } else {
        setTgMsg({ type: 'err', text: data.error || 'Could not clear token.' });
      }
    } catch {
      setTgMsg({ type: 'err', text: 'Network error clearing token.' });
    } finally {
      setTgSaving(false);
    }
  };

  const handleSaveBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtSaving(true);
    setBtMsg(null);
    try {
      const res = await fetch('/api/admin/bank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: btEnabled,
          bankName: btBankName.trim(),
          accountName: btAccountName.trim(),
          accountNumber: btAccountNumber.trim(),
          instructions: btInstructions.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBtMsg({
          type: 'err',
          text: data.error || 'Failed to save Direct Bank Transfer details.',
        });
      } else {
        setBtMsg({ type: 'ok', text: 'Direct Bank Transfer details saved.' });
      }
    } catch {
      setBtMsg({ type: 'err', text: 'Network error saving bank transfer details.' });
    } finally {
      setBtSaving(false);
    }
  };

  const handleSavePaystack = async (e: React.FormEvent) => {
    e.preventDefault();
    setPsSaving(true);
    setPsMsg(null);
    try {
      const res = await fetch('/api/admin/paystack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: psEnabled,
          publicKey: psPublicKey.trim(),
          secretKey: psSecretKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPsMsg({ type: 'err', text: data.error || 'Failed to save Paystack settings.' });
      } else {
        setPsSecretKey('');
        setPsHasSecret(Boolean(data.paystack?.hasSecretKey));
        setPsMaskedSecret(data.paystack?.maskedSecretKey || '');
        setPsMsg({ type: 'ok', text: 'Paystack settings saved.' });
      }
    } catch {
      setPsMsg({ type: 'err', text: 'Network error saving Paystack settings.' });
    } finally {
      setPsSaving(false);
    }
  };

  const handleClearPaystackSecret = async () => {
    setPsSaving(true);
    setPsMsg(null);
    try {
      const res = await fetch('/api/admin/paystack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearSecretKey: true, enabled: false }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPsSecretKey('');
        setPsHasSecret(false);
        setPsMaskedSecret('');
        setPsEnabled(false);
        setPsMsg({ type: 'ok', text: 'Paystack Secret Key cleared and checkout disabled.' });
      } else {
        setPsMsg({ type: 'err', text: data.error || 'Could not clear secret key.' });
      }
    } catch {
      setPsMsg({ type: 'err', text: 'Network error clearing secret key.' });
    } finally {
      setPsSaving(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPinMsg({ type: 'err', text: data.error || 'Could not update PIN.' });
      } else {
        setCurrentPin('');
        setNewPin('');
        setPinMsg({ type: 'ok', text: 'Admin PIN updated.' });
      }
    } catch {
      setPinMsg({ type: 'err', text: 'Network error updating PIN.' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile & Shop Currency Form */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <h2 className="font-display text-lg font-bold text-zinc-100">
          Portfolio Profile &amp; Storefront Settings
        </h2>
        <p className="mb-5 text-xs text-zinc-400">
          Customize every heading, bio, contact link, and shop currency shown on your website.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Navbar Brand Title
            </label>
            <input
              type="text"
              value={brandTitle}
              onChange={e => setBrandTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Role / Title</label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Availability Badge
            </label>
            <input
              type="text"
              value={availability}
              onChange={e => setAvailability(e.target.value)}
              placeholder="Available for new projects"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Hero Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Hero Intro</label>
            <textarea
              rows={2}
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">About Section Text</label>
            <textarea
              rows={3}
              value={aboutText}
              onChange={e => setAboutText(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Skills / Stack (comma separated)
            </label>
            <input
              type="text"
              value={skillsText}
              onChange={e => setSkillsText(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Contact Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">GitHub URL</label>
            <input
              type="url"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Telegram Handle (optional)
            </label>
            <input
              type="text"
              value={telegramHandle}
              onChange={e => setTelegramHandle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Shop Currency
            </label>
            <div className="flex gap-2">
              <select
                value={
                  CURRENCY_PRESETS.some(c => c.code === currencyCode) ? currencyCode : 'CUSTOM'
                }
                onChange={e => {
                  const preset = CURRENCY_PRESETS.find(c => c.code === e.target.value);
                  if (preset) {
                    setCurrencyCode(preset.code);
                    setCurrencySymbol(preset.symbol);
                  }
                }}
                className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
              >
                {CURRENCY_PRESETS.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={currencySymbol}
                onChange={e => setCurrencySymbol(e.target.value)}
                aria-label="Currency symbol"
                className="w-16 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-center text-sm text-zinc-100 outline-none focus:border-amber-400/60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Default Site Font Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FONT_SCALE_OPTIONS.map(opt => {
                const active = fontScale === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAdminFontScale(opt.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-400 text-zinc-950'
                        : 'border-white/10 bg-zinc-950 text-zinc-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Top Announcement Banner (leave blank to hide)
            </label>
            <input
              type="text"
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              placeholder="e.g. New template just launched — 20% off this week!"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
          {profileMsg ? (
            <span
              className={`text-xs ${
                profileMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {profileMsg.text}
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{savingProfile ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Telegram Bot Forwarding Settings */}
      <form
        onSubmit={handleSaveTelegram}
        className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-amber-300" />
              <h3 className="font-display text-base font-bold text-zinc-100">
                Telegram Forwarding &amp; Alerts
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Send incoming #contact form submissions, live chat messages, and orders directly to your Telegram bot.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={tgEnabled}
              onChange={e => setTgEnabled(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            <span>{tgEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        {tgLoading ? (
          <p className="text-xs text-zinc-400">Loading Telegram configuration...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    Telegram Bot Token (@BotFather)
                  </label>
                  {tgHasToken ? (
                    <button
                      type="button"
                      onClick={() => void handleClearTelegramToken()}
                      disabled={tgSaving}
                      className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Clear saved token
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <input
                    type={tgShowToken ? 'text' : 'password'}
                    value={tgBotToken}
                    onChange={e => setTgBotToken(e.target.value)}
                    placeholder={
                      tgHasToken
                        ? `Saved (${tgMaskedToken}) — leave blank to keep`
                        : '123456789:ABCdefGHIjklMNO...'
                    }
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 pr-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                  <button
                    type="button"
                    onClick={() => setTgShowToken(v => !v)}
                    aria-label={tgShowToken ? 'Hide bot token' : 'Show bot token'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {tgShowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Target Chat ID (user, group, or channel)
                </label>
                <input
                  type="text"
                  value={tgChatId}
                  onChange={e => setTgChatId(e.target.value)}
                  placeholder="e.g. 123456789 or -1001234567890"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 rounded-xl border border-white/[0.06] bg-zinc-950/70 px-4 py-3">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tgNotifyContact}
                  onChange={e => setTgNotifyContact(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                <span>#contact Form Messages</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tgNotifyChat}
                  onChange={e => setTgNotifyChat(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                <span>Live Chat Messages</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tgNotifyOrders}
                  onChange={e => setTgNotifyOrders(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-400"
                />
                <span>New Shop Orders</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              {tgMsg ? (
                <span
                  className={`text-xs ${
                    tgMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {tgMsg.text}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500">
                  Make sure you have sent /start to your bot before testing.
                </span>
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleTestTelegram()}
                  disabled={tgTesting || tgSaving}
                  className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-white/[0.1] disabled:opacity-60 cursor-pointer"
                >
                  {tgTesting ? 'Testing...' : 'Send Test Message'}
                </button>
                <button
                  type="submit"
                  disabled={tgSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{tgSaving ? 'Saving...' : 'Save Telegram'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Paystack Checkout Settings */}
      <form
        onSubmit={handleSavePaystack}
        className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-300" />
              <h3 className="font-display text-base font-bold text-zinc-100">
                Paystack Payment Gateway
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Accept cards, bank transfers, and USSD directly in your shop using your Paystack API keys.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={psEnabled}
              onChange={e => setPsEnabled(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            <span>{psEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        {psLoading ? (
          <p className="text-xs text-zinc-400">Loading Paystack settings...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    Paystack Secret Key (sk_test_ / sk_live_)
                  </label>
                  {psHasSecret ? (
                    <button
                      type="button"
                      onClick={() => void handleClearPaystackSecret()}
                      disabled={psSaving}
                      className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Clear saved key
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <input
                    type={psShowSecret ? 'text' : 'password'}
                    value={psSecretKey}
                    onChange={e => setPsSecretKey(e.target.value)}
                    placeholder={
                      psHasSecret
                        ? `Saved (${psMaskedSecret}) — leave blank to keep`
                        : 'sk_test_... or sk_live_...'
                    }
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 pr-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                  />
                  <button
                    type="button"
                    onClick={() => setPsShowSecret(v => !v)}
                    aria-label={psShowSecret ? 'Hide secret key' : 'Show secret key'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {psShowSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Paystack Public Key (optional, pk_test_ / pk_live_)
                </label>
                <input
                  type="text"
                  value={psPublicKey}
                  onChange={e => setPsPublicKey(e.target.value)}
                  placeholder="pk_test_... or pk_live_..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              {psMsg ? (
                <span
                  className={`text-xs ${
                    psMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {psMsg.text}
                </span>
              ) : (
                <span className="font-mono-code text-[11px] text-zinc-500">
                  Webhook URL: /api/paystack/webhook
                </span>
              )}

              <button
                type="submit"
                disabled={psSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{psSaving ? 'Saving...' : 'Save Paystack'}</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Direct Bank Transfer Settings (Paystack Alternative) */}
      <form
        onSubmit={handleSaveBankTransfer}
        className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-400" />
              <h3 className="font-display text-base font-bold text-zinc-100">
                Direct Bank Transfer Settings
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Offer a fee-free Paystack alternative across Managed Hosting and Shop Checkout with
              manual verification.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              disabled={btLoading}
              checked={btEnabled}
              onChange={e => setBtEnabled(e.target.checked)}
              className="h-4 w-4 accent-emerald-400 disabled:opacity-50"
            />
            <span>{btEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        {btLoading ? (
          <p className="text-xs text-zinc-400">Loading Bank Transfer settings...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={btBankName}
                  onChange={e => setBtBankName(e.target.value)}
                  placeholder="e.g. Guaranty Trust Bank"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Account Name
                </label>
                <input
                  type="text"
                  value={btAccountName}
                  onChange={e => setBtAccountName(e.target.value)}
                  placeholder="e.g. Ishola Technologies"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                  Account Number
                </label>
                <input
                  type="text"
                  value={btAccountNumber}
                  onChange={e => setBtAccountNumber(e.target.value)}
                  placeholder="e.g. 0123456789"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 font-mono-code text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/60"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Transfer Instructions (optional)
              </label>
              <input
                type="text"
                value={btInstructions}
                onChange={e => setBtInstructions(e.target.value)}
                placeholder="Include your email or project name in the transfer narration."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/60"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              {btMsg ? (
                <span
                  className={`text-xs ${
                    btMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {btMsg.text}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-500">
                  Shown automatically on #host and Cart checkout when enabled.
                </span>
              )}

              <button
                type="submit"
                disabled={btSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{btSaving ? 'Saving...' : 'Save Bank Transfer'}</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Change Admin PIN */}
      <form
        onSubmit={handleUpdatePin}
        className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-300" />
          <h3 className="font-display text-base font-bold text-zinc-100">Change Admin PIN</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Current PIN</label>
            <input
              type="password"
              required
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              New PIN (min 6 characters)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {pinMsg ? (
            <span className={`text-xs ${pinMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {pinMsg.text}
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-white/[0.1] cursor-pointer"
          >
            Update PIN
          </button>
        </div>
      </form>
    </div>
  );
}
