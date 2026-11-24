'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { formatPrice } from '@/lib/format';
import { ContactMessage, Order, OrderStatus, PaymentStatus } from '@/lib/types';
import { CheckCircle2, Mail, MessageSquare, Search, ShoppingBag, Trash2 } from 'lucide-react';

export default function OrdersMessagesManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, msgRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/messages', { cache: 'no-store' }),
      ]);
      const [ordData, msgData] = await Promise.all([ordRes.json(), msgRes.json()]);
      if (ordData.success && Array.isArray(ordData.orders)) setOrders(ordData.orders);
      if (msgData.success && Array.isArray(msgData.messages)) setMessages(msgData.messages);
    } catch (err) {
      console.error('Failed to fetch orders/messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrderStatus = async (id: string, status: OrderStatus) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) loadData();
  };

  const handleMarkOrderPaid = async (id: string) => {
    const paymentStatus: PaymentStatus = 'paid';
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus }),
    });
    if (res.ok) loadData();
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm(`Delete order ${id}?`)) return;
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    if (res.ok) loadData();
  };

  const handleToggleRead = async (msg: ContactMessage) => {
    const res = await fetch(`/api/messages/${msg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: !msg.read }),
    });
    if (res.ok) loadData();
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    if (res.ok) loadData();
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-zinc-400">Loading inbox...</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Orders Panel */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-amber-300" />
          <h3 className="font-display text-base font-bold text-zinc-100">
            Shop Orders ({orders.length})
          </h3>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-500">
            No orders placed yet.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder="Search orders by narration code (OBT-...), order ID, or customer..."
                className="w-full rounded-xl border border-white/10 bg-zinc-950 py-2 pl-9 pr-3.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
              />
            </div>
            {orders
              .filter(ord => {
                const q = orderSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  (ord.paymentReference || '').toLowerCase().includes(q) ||
                  (ord.keyHint || '').toLowerCase().includes(q) ||
                  ord.id.toLowerCase().includes(q) ||
                  ord.customerName.toLowerCase().includes(q) ||
                  ord.customerEmail.toLowerCase().includes(q)
                );
              })
              .map(ord => (
              <div
                key={ord.id}
                className="rounded-xl border border-white/[0.08] bg-zinc-900/55 p-4 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-code font-bold text-amber-300">{ord.id}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={ord.status}
                      onChange={e => handleOrderStatus(ord.id, e.target.value as OrderStatus)}
                      className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(ord.id)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-zinc-300">
                  <span>
                    <span className="font-medium">{ord.customerName}</span> · {ord.customerEmail}
                  </span>
                  {ord.keyHint ? (
                    <span className="font-mono-code rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-amber-200/90">
                      Key ••••-{ord.keyHint}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-zinc-400">
                  <span>
                    Payment: {ord.paymentMethod} ·{' '}
                    <span className="font-mono-code font-semibold text-zinc-100">
                      {formatPrice(ord.total, ord.currencySymbol, ord.currencyCode)}
                    </span>
                  </span>
                  {ord.paymentStatus === 'paid' ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Paid
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        {ord.paymentStatus === 'failed' ? 'Payment Failed' : 'Awaiting Payment'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleMarkOrderPaid(ord.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Mark Paid</span>
                      </button>
                    </>
                  )}
                </div>
                {ord.paymentReference ? (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 font-mono-code text-[11px] text-amber-200">
                    <span>
                      {ord.paymentMethod === 'Bank Transfer' ? 'Narration Code:' : 'Ref:'}
                    </span>
                    <span className="font-bold text-white">{ord.paymentReference}</span>
                  </div>
                ) : null}
                <div className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2 text-zinc-400">
                  {ord.items.map(item => (
                    <div key={item.productId}>
                      • {item.title} × {item.quantity}
                    </div>
                  ))}
                  {ord.notes ? (
                    <div className="pt-1 text-zinc-300">Notes: {ord.notes}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Messages Panel */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-300" />
          <h3 className="font-display text-base font-bold text-zinc-100">
            Contact Messages ({messages.length})
          </h3>
        </div>

        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-500">
            No messages received yet.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 text-xs ${
                  msg.read
                    ? 'border-white/[0.06] bg-zinc-900/35 text-zinc-400'
                    : 'border-amber-400/30 bg-zinc-900/75 text-zinc-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-zinc-100">{msg.subject}</div>
                    <div className="mt-0.5 text-zinc-400">
                      From <span className="text-zinc-200">{msg.name}</span> ({msg.email})
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                      className="rounded-lg border border-white/10 p-1.5 text-zinc-300 hover:bg-white/5"
                      title="Reply by email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleToggleRead(msg)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5 cursor-pointer"
                    >
                      {msg.read ? 'Mark Unread' : 'Mark Read'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-300">
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
