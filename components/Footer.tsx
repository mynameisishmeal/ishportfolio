'use client';

import React from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import MotionReveal from './MotionReveal';

export default function Footer() {
  const { profile, goToPage } = useStore();

  return (
    <footer className="overflow-x-clip border-t border-white/[0.08] bg-zinc-950 px-4 py-6 sm:px-6">
      <MotionReveal mode="scroll" rootMargin="0px" threshold={0.01}>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="font-display text-sm font-bold text-zinc-100">
              {profile.brandTitle || profile.name}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} {profile.name}. Personal portfolio &amp; shop.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-zinc-400">
            <button type="button" onClick={() => goToPage(1)} className="hover:text-zinc-100 cursor-pointer">
              Projects
            </button>
            <button type="button" onClick={() => goToPage(2)} className="hover:text-zinc-100 cursor-pointer">
              Shop
            </button>
            <button type="button" onClick={() => goToPage(3)} className="hover:text-zinc-100 cursor-pointer">
              Host
            </button>
            <button type="button" onClick={() => goToPage(4)} className="hover:text-zinc-100 cursor-pointer">
              About
            </button>
            <button type="button" onClick={() => goToPage(5)} className="hover:text-zinc-100 cursor-pointer">
              Contact
            </button>
            <Link href="/admin" className="text-amber-300/90 hover:text-amber-200">
              Admin
            </Link>
          </div>
        </div>
      </MotionReveal>
    </footer>
  );
}
