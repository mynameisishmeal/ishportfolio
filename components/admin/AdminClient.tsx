'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ProjectsManager from '@/components/admin/ProjectsManager';
import ProductsManager from '@/components/admin/ProductsManager';
import OrdersMessagesManager from '@/components/admin/OrdersMessagesManager';
import LiveChatsManager from '@/components/admin/LiveChatsManager';
import HostRequestsManager from '@/components/admin/HostRequestsManager';
import ProfileSettingsManager from '@/components/admin/ProfileSettingsManager';
import {
  ArrowLeft,
  FolderGit2,
  Inbox,
  Lock,
  LogOut,
  MessageCircle,
  Server,
  Settings,
  ShoppingBag,
} from 'lucide-react';

type AdminTab = 'projects' | 'products' | 'inbox' | 'chats' | 'hosting' | 'settings';

export default function AdminClient({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('projects');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Incorrect PIN.');
      } else {
        setAuthenticated(true);
        setPin('');
      }
    } catch {
      setLoginError('Network error signing in.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/70 p-7 shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
            <Lock className="h-5 w-5" />
          </div>

          <h1 className="font-display mt-4 text-center text-xl font-bold text-zinc-100">
            Portfolio &amp; Shop Admin
          </h1>
          <p className="mt-1.5 text-center text-xs text-zinc-400">
            Enter your admin PIN to add projects, products, and edit your site.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <input
              type="password"
              autoFocus
              required
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-center text-sm tracking-widest text-zinc-100 outline-none focus:border-amber-400/60"
            />

            {loginError ? (
              <p className="text-center text-xs text-red-400">{loginError}</p>
            ) : null}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-xl bg-amber-400 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
            >
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Portfolio</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'products', label: 'Shop Products', icon: ShoppingBag },
    { id: 'inbox', label: 'Orders & Messages', icon: Inbox },
    { id: 'chats', label: 'Live Chats', icon: MessageCircle },
    { id: 'hosting', label: 'Hosting', icon: Server },
    { id: 'settings', label: 'Profile & Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Live Site</span>
            </Link>
            <h1 className="font-display text-base font-bold text-zinc-100">
              Admin Dashboard
            </h1>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-zinc-950'
                    : 'border border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Panel */}
        {activeTab === 'projects' && <ProjectsManager />}
        {activeTab === 'products' && <ProductsManager />}
        {activeTab === 'inbox' && <OrdersMessagesManager />}
        {activeTab === 'chats' && <LiveChatsManager />}
        {activeTab === 'hosting' && <HostRequestsManager />}
        {activeTab === 'settings' && <ProfileSettingsManager />}
      </div>
    </div>
  );
}
