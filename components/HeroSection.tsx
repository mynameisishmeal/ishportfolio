'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import MotionReveal from './MotionReveal';
import { ArrowRight, Github, Mail, MapPin, ShoppingBag } from 'lucide-react';

export default function HeroSection() {
  const { profile, projects, products, goToPage } = useStore();

  const inProgressCount = projects.filter(p => p.status === 'in_progress').length;
  const totalProjects = projects.length;
  const totalProducts = products.length;

  return (
    <section className="relative overflow-x-clip px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-3xl">
          {/* Availability & Location */}
          <MotionReveal mode="mount" delay={0.18}>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {profile.availability ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {profile.availability}
                </span>
              ) : null}

              {profile.location ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  {profile.location}
                </span>
              ) : null}
            </div>
          </MotionReveal>

          <MotionReveal mode="mount" delay={0.28}>
            <p className="font-mono-code mb-3 text-xs font-medium uppercase tracking-wider text-amber-300/90">
              {profile.name} — {profile.role}
            </p>
          </MotionReveal>

          <MotionReveal mode="mount" delay={0.38}>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              {profile.headline}
            </h1>
          </MotionReveal>

          <MotionReveal mode="mount" delay={0.5}>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              {profile.bio}
            </p>
          </MotionReveal>

          {/* Primary Actions */}
          <MotionReveal mode="mount" delay={0.62}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => goToPage(1)}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white cursor-pointer"
              >
                <span>View Projects</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => goToPage(2)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20 cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Browse Shop</span>
              </button>

              {profile.githubUrl ? (
                <a
                  href={profile.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                </a>
              ) : null}

              {profile.email ? (
                <a
                  href={`mailto:${profile.email}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
                >
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </a>
              ) : null}
            </div>
          </MotionReveal>
        </div>

        {/* Concise Real Stats Bar */}
        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MotionReveal mode="mount" delay={0.72}>
            <div
              onClick={() => goToPage(1)}
              className="h-full cursor-pointer rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 transition hover:border-white/20"
            >
              <div className="text-xs font-medium text-zinc-400">Currently Building</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-zinc-100">{inProgressCount}</span>
                <span className="text-xs text-amber-300">active projects in progress</span>
              </div>
            </div>
          </MotionReveal>

          <MotionReveal mode="mount" delay={0.82}>
            <div
              onClick={() => goToPage(1)}
              className="h-full cursor-pointer rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 transition hover:border-white/20"
            >
              <div className="text-xs font-medium text-zinc-400">Portfolio Archive</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-zinc-100">{totalProjects}</span>
                <span className="text-xs text-zinc-400">total projects showcased</span>
              </div>
            </div>
          </MotionReveal>

          <MotionReveal mode="mount" delay={0.92}>
            <div
              onClick={() => goToPage(2)}
              className="h-full cursor-pointer rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 transition hover:border-white/20"
            >
              <div className="text-xs font-medium text-zinc-400">Personal Shop</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-zinc-100">{totalProducts}</span>
                <span className="text-xs text-zinc-400">products &amp; services available</span>
              </div>
            </div>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
