'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { formatPrice, PRODUCT_TYPE_LABELS } from '@/lib/format';
import { Product } from '@/lib/types';
import AccessKeyAuthForm, { NewlyCreatedKeyBanner } from './AccessKeyAuthForm';
import ShopCheckoutPanel from './ShopCheckoutPanel';
import MotionReveal from './MotionReveal';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  KeyRound,
  Landmark,
  LogOut,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';

const PRODUCTS_PER_PAGE = 3;

export default function ShopSection() {
  const {
    profile,
    products,
    addToCart,
    accountUser,
    shopOrders,
    paymentConfig,
    accountLoading,
    refreshAccount,
    signOutAccount,
    goToPage,
  } = useStore();

  const [shopTab, setShopTab] = useState<'store' | 'orders'>('store');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [quickCheckout, setQuickCheckout] = useState<{
    product: Product;
    method: 'Paystack' | 'Bank Transfer';
  } | null>(null);
  const [quickQty, setQuickQty] = useState(1);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Auto-poll user orders while any bank transfer order is waiting for confirmation
  useEffect(() => {
    if (!accountUser) return;
    const hasPendingBank = shopOrders.some(
      o => o.paymentMethod === 'Bank Transfer' && o.paymentStatus !== 'paid'
    );
    if (!hasPendingBank) return;
    const timer = window.setInterval(() => {
      void refreshAccount();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [accountUser, shopOrders, refreshAccount]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ['all', ...unique];
  }, [products]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filtered.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (clamped === safePage) return;
    setCurrentPage(clamped);
    const scroller = document.querySelector<HTMLDivElement>('[data-book-scroll="shop"]');
    scroller?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openQuickCheckout = (product: Product, method: 'Paystack' | 'Bank Transfer') => {
    if (product.stock === 0) return;
    setQuickQty(1);
    setQuickCheckout({ product, method });
    void refreshAccount();
  };

  return (
    <section id="shop" className="overflow-x-clip px-6 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <MotionReveal mode="scroll">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono-code mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-300">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Personal Shop</span>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                Products, Templates &amp; Services
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
                Checkout instantly on any card with Paystack or Direct Bank Transfer using your
                unified Access Key.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white sm:self-auto"
            >
              <span>+ Add / Edit Products</span>
            </Link>
          </div>
        </MotionReveal>

        {/* Unified Key Identity Strip */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-4 sm:flex-row sm:items-center">
          {accountLoading ? (
            <div className="text-xs text-zinc-400">Checking your Access Key session...</div>
          ) : accountUser ? (
            <>
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {accountUser.name}
                    </span>
                    <span className="font-mono-code rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      Key ••••-{accountUser.keyHint}
                    </span>
                  </div>
                  <div className="truncate text-xs text-zinc-400">
                    {accountUser.email} · Shared across Shop &amp;{' '}
                    <button
                      type="button"
                      onClick={() => goToPage(3)}
                      className="text-amber-300 underline-offset-2 hover:underline cursor-pointer"
                    >
                      Hosting
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-white/10 bg-zinc-950 p-1">
                  <button
                    type="button"
                    onClick={() => setShopTab('store')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      shopTab === 'store'
                        ? 'bg-amber-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    Storefront
                  </button>
                  <button
                    type="button"
                    onClick={() => setShopTab('orders')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      shopTab === 'orders'
                        ? 'bg-amber-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <ReceiptText className="h-3.5 w-3.5" />
                    <span>My Orders ({shopOrders.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void signOutAccount();
                    setShopTab('store');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">
                    Unified Shop &amp; Hosting Key
                  </div>
                  <p className="text-xs text-zinc-400">
                    Sign in or generate one Access Key to check out via Paystack / Bank Transfer and
                    track orders.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 cursor-pointer self-start sm:self-center"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Create / Enter Key</span>
              </button>
            </>
          )}
        </div>

        <NewlyCreatedKeyBanner />

        {shopTab === 'orders' && accountUser ? (
          /* My Orders View scoped to Access Key */
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/45 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
              <div>
                <h3 className="font-display text-base font-bold text-zinc-100">
                  Orders for Key ••••-{accountUser.keyHint}
                </h3>
                <p className="text-xs text-zinc-400">
                  Paid and pending Bank Transfer / Paystack purchases linked to your key.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShopTab('store')}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer"
              >
                Back to Products
              </button>
            </div>

            {shopOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/50 p-10 text-center">
                <ReceiptText className="mx-auto h-8 w-8 text-zinc-600" />
                <p className="mt-3 text-sm font-medium text-zinc-300">No shop orders yet.</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Use Paystack or Bank Transfer on any product card to place your first order.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {shopOrders.map(ord => {
                  const isPaid = ord.paymentStatus === 'paid';
                  const isBank = ord.paymentMethod === 'Bank Transfer';
                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl border border-white/[0.08] bg-zinc-950/75 p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-code text-sm font-bold text-amber-300">
                              {ord.id}
                            </span>
                            <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-200">
                              {ord.paymentMethod}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-amber-400/15 text-amber-300'
                              }`}
                            >
                              {isPaid ? 'Paid' : 'Awaiting Payment'}
                            </span>
                            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] capitalize text-zinc-300">
                              {ord.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {new Date(ord.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="font-mono-code text-lg font-bold text-zinc-100">
                          {formatPrice(ord.total, ord.currencySymbol, ord.currencyCode)}
                        </div>
                      </div>

                      {isBank && !isPaid && ord.paymentReference ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200">
                          <div>
                            <div>
                              Narration Code:{' '}
                              <span className="font-mono-code font-bold text-white">
                                {ord.paymentReference}
                              </span>
                            </div>
                            {paymentConfig.bankTransfer ? (
                              <div className="mt-0.5 text-[11px] text-amber-200/80">
                                Transfer {formatPrice(ord.total, ord.currencySymbol, ord.currencyCode)}{' '}
                                to {paymentConfig.bankTransfer.bankName} ·{' '}
                                {paymentConfig.bankTransfer.accountNumber} (
                                {paymentConfig.bankTransfer.accountName})
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(ord.paymentReference!);
                              setCopiedOrderId(ord.id);
                              window.setTimeout(() => setCopiedOrderId(null), 1800);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-400/35 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-zinc-950 cursor-pointer"
                          >
                            {copiedOrderId === ord.id ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : null}

                      <div className="space-y-1 border-t border-white/[0.06] pt-2.5 text-xs text-zinc-300">
                        {ord.items.map(item => (
                          <div key={item.productId} className="flex justify-between">
                            <span>
                              {item.title} × {item.quantity}
                            </span>
                            <span className="font-mono-code text-zinc-400">
                              {formatPrice(
                                item.price * item.quantity,
                                ord.currencySymbol,
                                ord.currencyCode
                              )}
                            </span>
                          </div>
                        ))}
                        {ord.notes ? (
                          <p className="pt-1 text-[11px] text-zinc-400">Notes: {ord.notes}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Storefront View */
          <>
            {/* Category Pills + Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setCurrentPage(1);
                      }}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-amber-400 text-zinc-950 font-semibold'
                          : 'border border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                      }`}
                    >
                      {cat === 'all' ? 'All Items' : cat}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search products..."
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/70 py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            {/* Outer Products Container Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/45 p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
                <span className="font-mono-code text-xs text-zinc-400">
                  {filtered.length === 0
                    ? '0 items'
                    : `Showing ${startIndex + 1}–${Math.min(
                        startIndex + PRODUCTS_PER_PAGE,
                        filtered.length
                      )} of ${filtered.length} items`}
                </span>
                {totalPages > 1 ? (
                  <span className="font-mono-code text-xs text-amber-300/90">
                    Page {safePage} / {totalPages}
                  </span>
                ) : null}
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/50 p-10 text-center">
                  <Package className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-3 text-sm font-medium text-zinc-300">No products found.</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Try a different category or add new items in the Admin dashboard.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                  {paginatedProducts.map((product, idx) => {
                    const outOfStock = product.stock === 0;
                    const lowStock = product.stock > 0 && product.stock <= 5;
                    return (
                      <MotionReveal
                        key={`${safePage}-${product.id}`}
                        mode="mount"
                        delay={idx * 0.06}
                        randomJitterMax={0.03}
                        className="h-full"
                      >
                        <article
                          onClick={() => setActiveProduct(product)}
                          className="group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/75 transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-zinc-950"
                        >
                          <div>
                            {product.imageUrl ? (
                              <div className="aspect-[16/10] w-full overflow-hidden border-b border-white/[0.06] bg-zinc-950">
                                <img
                                  src={product.imageUrl}
                                  alt={product.title}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                />
                              </div>
                            ) : null}

                            <div className="p-6">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                                    {product.category}
                                  </span>
                                  <span className="font-mono-code text-[11px] text-zinc-500">
                                    {PRODUCT_TYPE_LABELS[product.type] || product.type}
                                  </span>
                                </div>

                                {product.badge ? (
                                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                                    {product.badge}
                                  </span>
                                ) : null}
                              </div>

                              <h3 className="font-display text-lg font-bold text-zinc-100 transition group-hover:text-amber-200">
                                {product.title}
                              </h3>

                              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                                {product.description}
                              </p>

                              {product.features.length > 0 && (
                                <ul className="mt-4 space-y-1.5">
                                  {product.features.slice(0, 3).map((feat, featIdx) => (
                                    <li
                                      key={featIdx}
                                      className="flex items-center gap-2 text-xs text-zinc-300"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                      <span className="truncate">{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          {/* Card Footer: Price + Direct Paystack / Bank Transfer + Cart */}
                          <div className="space-y-3 border-t border-white/[0.06] px-6 py-4">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-mono-code text-lg font-bold text-zinc-100">
                                  {formatPrice(
                                    product.price,
                                    profile.currencySymbol,
                                    profile.currencyCode
                                  )}
                                </div>
                                <div
                                  className={`text-[11px] ${
                                    outOfStock
                                      ? 'text-red-400'
                                      : lowStock
                                        ? 'text-amber-300'
                                        : 'text-zinc-500'
                                  }`}
                                >
                                  {outOfStock
                                    ? 'Out of stock'
                                    : product.stock < 0
                                      ? 'Available'
                                      : lowStock
                                        ? `Only ${product.stock} left`
                                        : `${product.stock} in stock`}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={e => {
                                  e.stopPropagation();
                                  addToCart(product);
                                }}
                                aria-label={`Add ${product.title} to Cart`}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                              >
                                <ShoppingBag className="h-3 w-3" />
                                <span>{outOfStock ? 'Sold Out' : '+ Cart'}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={e => {
                                  e.stopPropagation();
                                  openQuickCheckout(product, 'Paystack');
                                }}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>Paystack</span>
                              </button>

                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={e => {
                                  e.stopPropagation();
                                  openQuickCheckout(product, 'Bank Transfer');
                                }}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                              >
                                <Landmark className="h-3.5 w-3.5" />
                                <span>Bank Transfer</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      </MotionReveal>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 ? (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={() => handlePageChange(safePage - 1)}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                      const isActive = pageNum === safePage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => handlePageChange(pageNum)}
                          aria-label={`Shop page ${pageNum}`}
                          aria-current={isActive ? 'page' : undefined}
                          className={`h-8 min-w-[2rem] rounded-xl px-2.5 text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? 'bg-amber-400 text-zinc-950'
                              : 'border border-white/10 bg-zinc-950 text-zinc-400 hover:border-white/20 hover:text-zinc-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(safePage + 1)}
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Product Details Modal */}
      {activeProduct && (
        <div
          data-modal-open="true"
          onClick={() => setActiveProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-zinc-300">
                    {activeProduct.category}
                  </span>
                  <span className="font-mono-code text-xs text-zinc-400">
                    {PRODUCT_TYPE_LABELS[activeProduct.type]}
                  </span>
                  {activeProduct.badge ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      {activeProduct.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="font-display text-2xl font-bold text-zinc-100">
                  {activeProduct.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveProduct(null)}
                aria-label="Close product modal"
                className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeProduct.imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                <img
                  src={activeProduct.imageUrl}
                  alt={activeProduct.title}
                  className="max-h-60 w-full object-cover"
                />
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              {activeProduct.description}
            </p>

            {activeProduct.features.length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  What&apos;s Included
                </h4>
                <ul className="mt-2.5 space-y-2">
                  {activeProduct.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 space-y-3 rounded-xl border border-white/[0.08] bg-zinc-900/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-zinc-400">
                    {activeProduct.stock === 0
                      ? 'Out of stock'
                      : activeProduct.stock < 0
                        ? 'Ready to order'
                        : `${activeProduct.stock} available`}
                  </div>
                  <div className="font-mono-code text-2xl font-bold text-zinc-100">
                    {formatPrice(activeProduct.price, profile.currencySymbol, profile.currencyCode)}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={activeProduct.stock === 0}
                  onClick={() => {
                    addToCart(activeProduct);
                    setActiveProduct(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>{activeProduct.stock === 0 ? 'Sold Out' : 'Add to Cart'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={activeProduct.stock === 0}
                  onClick={() => {
                    const p = activeProduct;
                    setActiveProduct(null);
                    openQuickCheckout(p, 'Paystack');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Pay via Paystack</span>
                </button>

                <button
                  type="button"
                  disabled={activeProduct.stock === 0}
                  onClick={() => {
                    const p = activeProduct;
                    setActiveProduct(null);
                    openQuickCheckout(p, 'Bank Transfer');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                >
                  <Landmark className="h-4 w-4" />
                  <span>Bank Transfer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Shop Card Checkout Modal (Paystack / Bank Transfer) */}
      {quickCheckout && (
        <div
          data-modal-open="true"
          onClick={() => setQuickCheckout(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-3.5">
              <div className="min-w-0">
                <div className="font-mono-code text-[11px] uppercase tracking-wider text-amber-300">
                  Direct Card Checkout
                </div>
                <h3 className="truncate font-display text-lg font-bold text-zinc-100">
                  {quickCheckout.product.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickCheckout(null)}
                aria-label="Close direct checkout"
                className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-zinc-900/60 px-3.5 py-2.5">
              <div>
                <div className="text-xs font-medium text-zinc-300">Quantity</div>
                <div className="font-mono-code text-xs text-amber-300">
                  {formatPrice(
                    quickCheckout.product.price,
                    profile.currencySymbol,
                    profile.currencyCode
                  )}{' '}
                  each
                </div>
              </div>
              <div className="flex items-center rounded-lg border border-white/10 bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setQuickQty(q => Math.max(1, q - 1))}
                  aria-label="Decrease checkout quantity"
                  className="p-2 text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono-code px-3 text-xs font-semibold text-zinc-100">
                  {quickQty}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuickQty(q =>
                      quickCheckout.product.stock >= 0
                        ? Math.min(quickCheckout.product.stock, q + 1)
                        : q + 1
                    )
                  }
                  aria-label="Increase checkout quantity"
                  className="p-2 text-zinc-300 hover:text-white cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <ShopCheckoutPanel
              items={[{ product: quickCheckout.product, quantity: quickQty }]}
              initialMethod={quickCheckout.method}
              onOrderCompleted={() => setQuickCheckout(null)}
            />
          </div>
        </div>
      )}

      {/* Unified Access Key Auth Modal (Shop Header Bar Trigger) */}
      {showAuthModal && (
        <div
          data-modal-open="true"
          onClick={() => setShowAuthModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-xs font-semibold uppercase tracking-wider text-amber-300">
                Unified Account Session
              </span>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                aria-label="Close key modal"
                className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AccessKeyAuthForm
              onAuthenticated={() => setShowAuthModal(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
