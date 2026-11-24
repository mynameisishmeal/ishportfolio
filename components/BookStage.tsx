'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore } from '@/context/StoreContext';
import HeroSection from './HeroSection';
import ProjectsSection from './ProjectsSection';
import ShopSection from './ShopSection';
import HostSection from './HostSection';
import AboutSection from './AboutSection';
import ContactSection from './ContactSection';
import Footer from './Footer';
import { ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export const BOOK_PAGES = [
  { id: 'home', num: '01', label: 'Home' },
  { id: 'projects', num: '02', label: 'Projects' },
  { id: 'shop', num: '03', label: 'Shop' },
  { id: 'host', num: '04', label: 'Host' },
  { id: 'about', num: '05', label: 'About' },
  { id: 'contact', num: '06', label: 'Contact' },
] as const;

const BOOK_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const BOOK_EXIT_EASE: [number, number, number, number] = [0.4, 0, 1, 1];

export default function BookStage() {
  const { currentPage, pageDirection, goToPage, isCartOpen, completedOrder } = useStore();
  const prefersReduced = useReducedMotion();

  const scrollRef = useRef<HTMLDivElement>(null);
  const flipLockUntilRef = useRef<number>(0);
  const bottomEdgeAtRef = useRef<number>(0);
  const topEdgeAtRef = useRef<number>(0);
  const prevPageRef = useRef<number | null>(null);

  const getActiveScrollEl = useCallback((): HTMLDivElement | null => {
    if (typeof document !== 'undefined') {
      const pageId = BOOK_PAGES[currentPage]?.id;
      const found = document.querySelector<HTMLDivElement>(`[data-book-scroll="${pageId}"]`);
      if (found) return found;
    }
    return scrollRef.current;
  }, [currentPage]);

  const setActiveScrollRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      scrollRef.current = el;
    }
  }, []);

  const isModalActive = useCallback(() => {
    if (isCartOpen || Boolean(completedOrder)) return true;
    if (typeof document !== 'undefined') {
      return Boolean(document.querySelector('[data-modal-open="true"]'));
    }
    return false;
  }, [isCartOpen, completedOrder]);

  const tryFlipPage = useCallback(
    (nextIndex: number, dir?: 1 | -1) => {
      const now = Date.now();
      if (now < flipLockUntilRef.current) return false;
      const total = BOOK_PAGES.length;
      const wrapped = ((nextIndex % total) + total) % total;
      if (wrapped === currentPage) return false;

      flipLockUntilRef.current = now + 720;
      bottomEdgeAtRef.current = 0;
      topEdgeAtRef.current = 0;
      goToPage(wrapped, dir);
      return true;
    },
    [currentPage, goToPage]
  );

  // Sync URL hash and reset scroll position on page change
  useEffect(() => {
    const pageMeta = BOOK_PAGES[currentPage];
    if (pageMeta && typeof window !== 'undefined') {
      const currentHash = window.location.hash;
      const isInitialMount = prevPageRef.current === null || prevPageRef.current === currentPage;
      const hasKnownHash = BOOK_PAGES.some(p => `#${p.id}` === currentHash);
      if (!isInitialMount || !hasKnownHash) {
        const nextHash = `#${pageMeta.id}`;
        if (currentHash !== nextHash) {
          window.history.replaceState(null, '', nextHash);
        }
      }
      prevPageRef.current = currentPage;
    }
    const el = getActiveScrollEl();
    if (el) {
      el.scrollTop = 0;
    }
    bottomEdgeAtRef.current = 0;
    topEdgeAtRef.current = Date.now();
  }, [currentPage, getActiveScrollEl]);

  // Update edge timestamps whenever the active page scrolls
  const handleContainerScroll = () => {
    const el = getActiveScrollEl();
    if (!el) return;
    const now = Date.now();
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 5;
    const atTop = el.scrollTop <= 3;

    if (atBottom) {
      if (bottomEdgeAtRef.current === 0) bottomEdgeAtRef.current = now;
    } else {
      bottomEdgeAtRef.current = 0;
    }

    if (atTop) {
      if (topEdgeAtRef.current === 0) topEdgeAtRef.current = now;
    } else {
      topEdgeAtRef.current = 0;
    }
  };

  // Mouse wheel / trackpad page turning with boundary guard for long pages
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (isModalActive()) return;
      const el = getActiveScrollEl();
      if (!el) return;

      // Ignore tiny trackpad inertia jitter
      if (Math.abs(e.deltaY) < 14) return;

      const isScrollable = el.scrollHeight > el.clientHeight + 6;
      const atTop = el.scrollTop <= 3;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 5;
      const now = Date.now();

      if (e.deltaY > 0) {
        if (!atBottom) {
          bottomEdgeAtRef.current = 0;
          return; // let container scroll smoothly
        }

        if (!isScrollable) {
          e.preventDefault();
          tryFlipPage(currentPage + 1, 1);
          return;
        }

        // Scrollable page: brief pause at bottom prevents leftover flick momentum from skipping cards
        if (bottomEdgeAtRef.current === 0) {
          bottomEdgeAtRef.current = now;
          return;
        }
        if (now - bottomEdgeAtRef.current >= 220) {
          e.preventDefault();
          tryFlipPage(currentPage + 1, 1);
        }
      } else if (e.deltaY < 0) {
        if (!atTop) {
          topEdgeAtRef.current = 0;
          return;
        }

        if (!isScrollable) {
          e.preventDefault();
          tryFlipPage(currentPage - 1, -1);
          return;
        }

        if (topEdgeAtRef.current === 0) {
          topEdgeAtRef.current = now;
          return;
        }
        if (now - topEdgeAtRef.current >= 220) {
          e.preventDefault();
          tryFlipPage(currentPage - 1, -1);
        }
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [currentPage, isModalActive, tryFlipPage, getActiveScrollEl]);

  // Mobile touch swipe turning (only flips if user starts swipe already at top/bottom edge)
  useEffect(() => {
    let startY = 0;
    let startX = 0;
    let startedAtTop = false;
    let startedAtBottom = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      const el = getActiveScrollEl();
      if (!el) return;
      const isScrollable = el.scrollHeight > el.clientHeight + 6;
      startedAtTop = !isScrollable || el.scrollTop <= 4;
      startedAtBottom = !isScrollable || el.scrollHeight - el.scrollTop - el.clientHeight <= 6;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isModalActive() || e.changedTouches.length !== 1) return;
      const deltaY = startY - e.changedTouches[0].clientY;
      const deltaX = startX - e.changedTouches[0].clientX;
      if (Math.abs(deltaY) < 44 || Math.abs(deltaY) < Math.abs(deltaX)) return;

      if (deltaY > 0 && startedAtBottom) {
        tryFlipPage(currentPage + 1, 1);
      } else if (deltaY < 0 && startedAtTop) {
        tryFlipPage(currentPage - 1, -1);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [currentPage, isModalActive, tryFlipPage, getActiveScrollEl]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalActive()) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        tryFlipPage(currentPage + 1, 1);
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        tryFlipPage(currentPage - 1, -1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentPage, isModalActive, tryFlipPage]);

  const prevPage = BOOK_PAGES[(currentPage - 1 + BOOK_PAGES.length) % BOOK_PAGES.length];
  const nextPage = BOOK_PAGES[(currentPage + 1) % BOOK_PAGES.length];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-950">
      <main
        className="studio-grid-bg relative min-h-0 flex-1 overflow-hidden"
        style={{ perspective: '1800px' }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={BOOK_PAGES[currentPage].id}
            initial={
              prefersReduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    rotateY: pageDirection > 0 ? 18 : -18,
                    x: pageDirection > 0 ? 56 : -56,
                    scale: 0.965,
                    filter: 'blur(6px)',
                  }
            }
            animate={
              prefersReduced
                ? { opacity: 1, transition: { duration: 0.2 } }
                : {
                    opacity: 1,
                    rotateY: 0,
                    x: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    transition: { duration: 0.46, ease: BOOK_EASE },
                  }
            }
            exit={
              prefersReduced
                ? { opacity: 0, transition: { duration: 0.15 } }
                : {
                    opacity: 0,
                    rotateY: pageDirection > 0 ? -16 : 16,
                    x: pageDirection > 0 ? -48 : 48,
                    scale: 0.965,
                    filter: 'blur(5px)',
                    pointerEvents: 'none',
                    transition: { duration: 0.28, ease: BOOK_EXIT_EASE },
                  }
            }
            style={{
              transformOrigin: pageDirection > 0 ? 'left center' : 'right center',
              transformStyle: 'preserve-3d',
            }}
            className="absolute inset-0 h-full w-full"
          >
            <div
              ref={setActiveScrollRef}
              data-book-scroll={BOOK_PAGES[currentPage].id}
              onScroll={handleContainerScroll}
              className="h-full w-full overflow-y-auto overflow-x-clip"
            >
              <div className="flex min-h-full flex-col justify-between">
                <div className={currentPage === 0 || currentPage === 4 ? 'flex flex-1 items-center' : 'flex-1'}>
                  <div className="w-full">
                    {currentPage === 0 && <HeroSection />}
                    {currentPage === 1 && <ProjectsSection />}
                    {currentPage === 2 && <ShopSection />}
                    {currentPage === 3 && <HostSection />}
                    {currentPage === 4 && <AboutSection />}
                    {currentPage === 5 && <ContactSection />}
                  </div>
                </div>

                {currentPage === 5 ? <Footer /> : null}

                {/* Inline Page-Turn Bar at the end of Pages 1..4 */}
                {currentPage > 0 && (
                  <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
                    <button
                      type="button"
                      onClick={() => tryFlipPage(currentPage - 1, -1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Previous: {prevPage.label}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => tryFlipPage(currentPage + 1, 1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20 cursor-pointer"
                    >
                      <span>Next: {nextPage.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Non-overlapping Bottom Book Page Controls */}
      <div className="z-30 flex h-12 shrink-0 items-center justify-center border-t border-white/[0.06] bg-zinc-950/95 px-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => tryFlipPage(currentPage - 1, -1)}
            aria-label="Previous page"
            className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 px-1">
            {BOOK_PAGES.map((pg, idx) => {
              const active = idx === currentPage;
              return (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => tryFlipPage(idx)}
                  aria-label={`Go to ${pg.label}`}
                  title={`${pg.num}. ${pg.label}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    active ? 'w-5 bg-amber-400' : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'
                  }`}
                />
              );
            })}
          </div>

          <span className="font-mono-code hidden text-[11px] text-zinc-400 sm:inline">
            {BOOK_PAGES[currentPage].num} / 0{BOOK_PAGES.length} · {BOOK_PAGES[currentPage].label}
          </span>

          <button
            type="button"
            onClick={() => tryFlipPage(currentPage + 1, 1)}
            aria-label="Next page"
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-400/15 cursor-pointer"
          >
            {currentPage === 0 && (
              <span className="hidden pl-1 text-[11px] text-zinc-300 sm:inline">
                Scroll to turn
              </span>
            )}
            {currentPage === 0 ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
