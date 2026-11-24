'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion';

export type RevealPreset =
  | 'floatUp'
  | 'floatLeft'
  | 'floatRight'
  | 'slideLeft'
  | 'slideRight'
  | 'dropIn'
  | 'zoomBlur'
  | 'tiltRise';

export const ALL_REVEAL_PRESETS: RevealPreset[] = [
  'floatUp',
  'floatLeft',
  'floatRight',
  'slideLeft',
  'slideRight',
  'dropIn',
  'zoomBlur',
  'tiltRise',
];

const PRESET_HIDDEN: Record<RevealPreset, TargetAndTransition> = {
  floatUp: { opacity: 0, y: 46, scale: 0.97, filter: 'blur(6px)' },
  floatLeft: { opacity: 0, x: -24, y: 36, rotate: -1.5, scale: 0.97, filter: 'blur(6px)' },
  floatRight: { opacity: 0, x: 24, y: 36, rotate: 1.5, scale: 0.97, filter: 'blur(6px)' },
  slideLeft: { opacity: 0, x: -40, y: 6, filter: 'blur(4px)' },
  slideRight: { opacity: 0, x: 40, y: 6, filter: 'blur(4px)' },
  dropIn: { opacity: 0, y: -26, scale: 0.98, filter: 'blur(4px)' },
  zoomBlur: { opacity: 0, scale: 0.9, filter: 'blur(8px)' },
  tiltRise: { opacity: 0, y: 34, rotate: -2, scale: 0.96, filter: 'blur(5px)' },
};

const VISIBLE_STATE: TargetAndTransition = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  filter: 'blur(0px)',
};

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

function pickRandomPreset(pool: RevealPreset[]): RevealPreset {
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] || 'floatUp';
}

interface MotionRevealProps {
  children: React.ReactNode;
  className?: string;
  mode?: 'mount' | 'scroll';
  delay?: number;
  randomJitterMax?: number;
  preset?: RevealPreset;
  presets?: RevealPreset[];
  threshold?: number;
  rootMargin?: string;
}

export default function MotionReveal({
  children,
  className,
  mode = 'scroll',
  delay = 0,
  randomJitterMax = 0.1,
  preset,
  presets = ALL_REVEAL_PRESETS,
  threshold = 0.02,
  rootMargin = '0px 0px -16px 0px',
}: MotionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const prefersReduced = useReducedMotion();

  const [chosenPreset, setChosenPreset] = useState<RevealPreset>(preset || 'floatUp');
  const [jitter, setJitter] = useState(0);
  const [duration, setDuration] = useState(0.74);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  // Randomize once on client mount so SSR starts completely empty without hydration mismatch
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const selected = preset || pickRandomPreset(presets);
    const extraDelay = randomJitterMax > 0 ? Math.random() * randomJitterMax : 0;
    const randomDur = 0.62 + Math.random() * 0.28;
    setChosenPreset(selected);
    setJitter(extraDelay);
    setDuration(randomDur);
    setReady(true);
  }, [preset, presets, randomJitterMax]);

  useEffect(() => {
    if (!ready || visible) return;

    if (prefersReduced) {
      setVisible(true);
      return;
    }

    if (mode === 'mount') {
      const ms = Math.max(80, Math.round((delay + jitter) * 1000));
      const timer = window.setTimeout(() => setVisible(true), ms);
      return () => window.clearTimeout(timer);
    }

    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    let triggered = false;
    const reveal = () => {
      if (triggered) return;
      triggered = true;
      setVisible(true);
    };

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [ready, visible, mode, delay, jitter, threshold, rootMargin, prefersReduced]);

  const hiddenState: TargetAndTransition = prefersReduced
    ? { opacity: 0 }
    : PRESET_HIDDEN[chosenPreset];

  const isSpring =
    chosenPreset === 'floatUp' ||
    chosenPreset === 'floatLeft' ||
    chosenPreset === 'floatRight' ||
    chosenPreset === 'tiltRise';

  // Instant snap while hidden so randomized start offsets are ready before reveal triggers
  const transition: Transition = !visible
    ? { duration: 0 }
    : prefersReduced
      ? { duration: 0.2 }
      : isSpring
        ? {
            type: 'spring',
            stiffness: 84,
            damping: 15,
            mass: 0.85,
            delay: mode === 'scroll' ? delay + jitter : 0,
          }
        : {
            duration,
            ease: EASE_OUT_EXPO,
            delay: mode === 'scroll' ? delay + jitter : 0,
          };

  return (
    <motion.div
      ref={ref}
      initial={hiddenState}
      animate={visible ? VISIBLE_STATE : hiddenState}
      transition={transition}
      className={className}
      style={{ willChange: visible ? 'auto' : 'transform, opacity, filter' }}
    >
      {children}
    </motion.div>
  );
}
