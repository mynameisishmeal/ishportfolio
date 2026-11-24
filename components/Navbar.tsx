'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStore } from '@/context/StoreContext';
import { BOOK_PAGES } from './BookStage';
import { FONT_SCALE_OPTIONS } from '@/lib/format';
import { KeyRound, Menu, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';

export default function Navbar() {
  const {
    profile,
    cart,
    setIsCartOpen,
    accountUser,
    currentPage,
    goToPage,
    fontScale,
    setFontScale,
  } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleNavClick = (index: number) => {
    goToPage(index);
    setMobileOpen(false);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: -18 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="z-40 w-full shrink-0 border-b border-white/[0.08] bg-zinc-950/90 backdrop-blur-xl"
    >
      {profile.announcement ? (
        <div className="border-b border-white/[0.06] bg-amber-400/10 px-4 py-1.5 text-center text-xs font-medium text-amber-200">
          {profile.announcement}
        </div>
      ) : null}

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => handleNavClick(0)}
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-zinc-100 transition hover:text-white cursor-pointer"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-sm font-extrabold text-amber-300">
            {(profile.brandTitle || 'I').charAt(0).toUpperCase()}
          </span>
          <span>{profile.brandTitle || profile.name}</span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1 md:flex">
          {BOOK_PAGES.map((pg, idx) => {
            const active = currentPage === idx;
            return (
              <button
                key={pg.id}
                type="button"
                onClick={() => handleNavClick(idx)}
                className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active ? 'text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeNavPagePill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-amber-400"
                  />
                )}
                <span className="relative z-10">{pg.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {/* Global Font Scale Switcher (12px / 14px / 16px) */}
          <div
            role="group"
            aria-label="Text size"
            className="hidden items-center rounded-lg border border-white/10 bg-white/[0.02] p-0.5 sm:inline-flex"
          >
            {FONT_SCALE_OPTIONS.map(opt => {
              const active = fontScale === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFontScale(opt.id)}
                  title={opt.label}
                  aria-label={`Set text size ${opt.label}`}
                  aria-pressed={active}
                  className={`font-mono-code rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>

          <Link
            href="/admin"
            className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:inline-flex"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
            <span>Manage</span>
          </Link>

          {accountUser ? (
            <button
              type="button"
              onClick={() => goToPage(2)}
              title={`Signed in as ${accountUser.name} (${accountUser.email})`}
              className="hidden items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 font-mono-code text-[11px] font-semibold text-amber-200 transition hover:bg-amber-400/20 lg:inline-flex cursor-pointer"
            >
              <KeyRound className="h-3 w-3 text-amber-300" />
              <span>••••-{accountUser.keyHint}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label="Open shopping cart"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 cursor-pointer"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Cart</span>
            {totalCartItems > 0 && (
              <span className="rounded-full bg-zinc-950/15 px-1.5 py-0.5 text-[11px] font-bold">
                {totalCartItems}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label="Toggle navigation menu"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 p-2 text-zinc-300 hover:bg-white/5 md:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-zinc-950 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1.5">
            {BOOK_PAGES.map((pg, idx) => {
              const active = currentPage === idx;
              return (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => handleNavClick(idx)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium cursor-pointer ${
                    active
                      ? 'bg-amber-400/15 text-amber-200'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span>{pg.label}</span>
                  <span className="font-mono-code text-xs opacity-60">{pg.num}</span>
                </button>
              );
            })}
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-white/[0.07]"
            >
              <SlidersHorizontal className="h-4 w-4 text-amber-300" />
              <span>Manage Portfolio &amp; Shop</span>
            </Link>

            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="text-xs font-medium text-zinc-400">Text Size</span>
              <div className="inline-flex items-center gap-1">
                {FONT_SCALE_OPTIONS.map(opt => {
                  const active = fontScale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFontScale(opt.id)}
                      title={opt.label}
                      aria-label={`Set text size ${opt.label}`}
                      className={`font-mono-code min-w-[2rem] rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-amber-400 text-zinc-950 font-semibold'
                          : 'bg-zinc-900 text-zinc-300 hover:text-white'
                      }`}
                    >
                      {opt.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>
      )}
    </motion.header>
  );
}
