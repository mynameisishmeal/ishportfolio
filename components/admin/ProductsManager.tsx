'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { formatPrice, PRODUCT_TYPE_LABELS } from '@/lib/format';
import { Product, ProductType } from '@/lib/types';
import ImageUploadField from './ImageUploadField';
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';

interface ProductFormState {
  title: string;
  category: string;
  type: ProductType;
  price: string;
  unlimitedStock: boolean;
  stock: string;
  badge: string;
  description: string;
  featuresText: string;
  imageUrl: string;
  featured: boolean;
  active: boolean;
}

const EMPTY_FORM: ProductFormState = {
  title: '',
  category: 'Templates',
  type: 'digital',
  price: '49',
  unlimitedStock: true,
  stock: '10',
  badge: '',
  description: '',
  featuresText: '',
  imageUrl: '',
  featured: false,
  active: true,
};

function toFormState(prod: Product): ProductFormState {
  return {
    title: prod.title,
    category: prod.category,
    type: prod.type,
    price: String(prod.price),
    unlimitedStock: prod.stock < 0,
    stock: prod.stock >= 0 ? String(prod.stock) : '10',
    badge: prod.badge || '',
    description: prod.description,
    featuresText: prod.features.join('\n'),
    imageUrl: prod.imageUrl || '',
    featured: prod.featured,
    active: prod.active !== false,
  };
}

export default function ProductsManager() {
  const { profile, refreshProducts } = useStore();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAllProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?all=1', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setAllProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to fetch admin products:', err);
    }
  }, []);

  useEffect(() => {
    loadAllProducts();
  }, [loadAllProducts]);

  const existingCategories = Array.from(
    new Set(['Templates', 'Services', 'Tools', 'Physical Goods', ...allProducts.map(p => p.category)])
  );

  const startEdit = (prod: Product) => {
    setEditingId(prod.id);
    setForm(toFormState(prod));
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload = {
      title: form.title,
      category: form.category.trim() || 'General',
      type: form.type,
      price: Number(form.price) || 0,
      stock: form.unlimitedStock ? -1 : Math.max(0, Math.floor(Number(form.stock) || 0)),
      badge: form.badge.trim(),
      description: form.description.trim(),
      features: form.featuresText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      imageUrl: form.imageUrl.trim(),
      featured: form.featured,
      active: form.active,
    };

    try {
      const url = editingId ? `/api/products/${editingId}` : '/api/products';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'err', text: data.error || 'Could not save product.' });
      } else {
        await Promise.all([loadAllProducts(), refreshProducts()]);
        setForm(EMPTY_FORM);
        setEditingId(null);
        setFeedback({
          type: 'ok',
          text: editingId ? 'Product updated.' : 'New product added to your shop.',
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error while saving product.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (prod: Product) => {
    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !prod.active }),
      });
      if (res.ok) {
        await Promise.all([loadAllProducts(), refreshProducts()]);
      }
    } catch (err) {
      console.error('Failed to toggle product visibility:', err);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete product "${title}"?`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (editingId === id) cancelEdit();
        await Promise.all([loadAllProducts(), refreshProducts()]);
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add / Edit Product Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">
              {editingId ? 'Edit Shop Product' : 'Add New Shop Product'}
            </h2>
            <p className="text-xs text-zinc-400">
              Create digital products, services, or physical goods with custom categories.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Next.js Storefront Starter"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Category (or type new) *
              </label>
              <input
                type="text"
                required
                list="product-category-suggestions"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="Templates, Merchandise..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
              />
              <datalist id="product-category-suggestions">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">Type</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as ProductType })}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
              >
                <option value="digital">Digital Product</option>
                <option value="service">Service</option>
                <option value="physical">Physical Item</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Price ({profile.currencySymbol} {profile.currencyCode}) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                Badge (optional)
              </label>
              <input
                type="text"
                value={form.badge}
                onChange={e => setForm({ ...form, badge: e.target.value })}
                placeholder="New, Popular, Limited..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Inventory</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.unlimitedStock}
                  onChange={e => setForm({ ...form, unlimitedStock: e.target.checked })}
                  className="h-4 w-4 accent-amber-400"
                />
                <span>Unlimited</span>
              </label>

              {!form.unlimitedStock && (
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={e => setForm({ ...form, stock: e.target.value })}
                  className="w-28 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                />
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Explain what this product or service offers..."
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">
              What&apos;s Included / Features (one per line)
            </label>
            <textarea
              rows={3}
              value={form.featuresText}
              onChange={e => setForm({ ...form, featuresText: e.target.value })}
              placeholder={'Full source code\nDocumentation & setup guide'}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-2">
            <ImageUploadField
              label="Product Image (Upload or URL)"
              value={form.imageUrl}
              onChange={url => setForm({ ...form, imageUrl: url })}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-4">
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 accent-amber-400"
              />
              <span>Visible in shop</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={e => setForm({ ...form, featured: e.target.checked })}
                className="h-4 w-4 accent-amber-400"
              />
              <span>Featured</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Product'}</span>
          </button>
        </div>

        {feedback ? (
          <p
            className={`mt-3 text-xs ${
              feedback.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {feedback.text}
          </p>
        ) : null}
      </form>

      {/* Existing Products List */}
      <div>
        <h3 className="font-display mb-4 text-base font-bold text-zinc-200">
          Shop Catalog ({allProducts.length})
        </h3>

        {allProducts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
            No products yet. Add your first shop item above.
          </p>
        ) : (
          <div className="space-y-3">
            {allProducts.map(prod => (
              <div
                key={prod.id}
                className={`flex flex-col justify-between gap-4 rounded-xl border border-white/[0.08] p-4 sm:flex-row sm:items-center ${
                  prod.active ? 'bg-zinc-900/50' : 'bg-zinc-900/20 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-100">{prod.title}</span>
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300">
                      {prod.category}
                    </span>
                    <span className="font-mono-code text-xs font-semibold text-amber-300">
                      {formatPrice(prod.price, profile.currencySymbol, profile.currencyCode)}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      · {PRODUCT_TYPE_LABELS[prod.type]} ·{' '}
                      {prod.stock < 0 ? 'Unlimited' : `${prod.stock} left`}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-400">{prod.description}</p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => toggleActive(prod)}
                    title={prod.active ? 'Hide from shop' : 'Show in shop'}
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
                  >
                    {prod.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(prod)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prod.id, prod.title)}
                    aria-label={`Delete ${prod.title}`}
                    className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
