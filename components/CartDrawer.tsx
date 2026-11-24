'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { formatPrice } from '@/lib/format';
import ShopCheckoutPanel from './ShopCheckoutPanel';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

export default function CartDrawer() {
  const {
    profile,
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isCartOpen,
    setIsCartOpen,
    refreshAccount,
  } = useStore();

  useEffect(() => {
    if (!isCartOpen) return;
    void refreshAccount();
  }, [isCartOpen, refreshAccount]);

  if (!isCartOpen) return null;

  return (
    <div
      onClick={() => setIsCartOpen(false)}
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-base font-bold">Your Cart</h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-300">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close cart"
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag className="h-9 w-9 text-zinc-700" />
              <p className="mt-3 text-sm font-medium text-zinc-300">Your cart is empty</p>
              <p className="mt-1 text-xs text-zinc-500">
                Add products or services from the shop to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {item.product.title}
                    </div>
                    <div className="font-mono-code mt-0.5 text-xs text-amber-300">
                      {formatPrice(item.product.price, profile.currencySymbol, profile.currencyCode)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-white/10 bg-zinc-950">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="p-1.5 text-zinc-300 hover:text-white cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-mono-code px-2 text-xs font-medium">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="p-1.5 text-zinc-300 hover:text-white cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      aria-label="Remove item"
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unified Checkout Panel (Access Key + Paystack & Bank Transfer Only) */}
        {cart.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto border-t border-white/[0.08] bg-zinc-900/40 px-6 py-5">
            <ShopCheckoutPanel
              items={cart}
              onOrderCompleted={() => {
                clearCart();
                setIsCartOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
