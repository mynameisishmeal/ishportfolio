'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import MotionReveal from './MotionReveal';
import { Code2, MapPin, User } from 'lucide-react';

export default function AboutSection() {
  const { profile } = useStore();

  return (
    <section id="about" className="overflow-x-clip px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 lg:grid-cols-12">
        {/* About Copy */}
        <div className="lg:col-span-7">
          <MotionReveal mode="scroll">
            <div className="font-mono-code mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-300">
              <User className="h-3.5 w-3.5" />
              <span>About</span>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
              About {profile.name}
            </h2>
          </MotionReveal>

          <MotionReveal mode="scroll" delay={0.08}>
            <p className="mt-4 text-base leading-relaxed text-zinc-300">
              {profile.aboutText}
            </p>
          </MotionReveal>

          <MotionReveal mode="scroll" delay={0.14}>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-zinc-400">
              {profile.location ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-2">
                  <MapPin className="h-3.5 w-3.5 text-amber-300" />
                  <span>{profile.location}</span>
                </div>
              ) : null}
              {profile.availability ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-900/60 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{profile.availability}</span>
                </div>
              ) : null}
            </div>
          </MotionReveal>
        </div>

        {/* Tech Stack & Tools */}
        <div className="lg:col-span-5">
          <MotionReveal mode="scroll" delay={0.1}>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-amber-300" />
                <h3 className="font-display text-base font-bold text-zinc-100">
                  Tools &amp; Technologies
                </h3>
              </div>
              {profile.skills.length === 0 ? (
                <p className="text-xs text-zinc-500">No skills added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, idx) => (
                    <MotionReveal key={skill} mode="scroll" delay={0.04 * (idx % 5)}>
                      <span className="font-mono-code inline-block rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200">
                        {skill}
                      </span>
                    </MotionReveal>
                  ))}
                </div>
              )}
            </div>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
