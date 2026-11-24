'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatThread } from '@/lib/types';
import {
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LiveChatsManager() {
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/admin/chats', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Could not load live chats.');
        return;
      }
      setError('');
      const list: ChatThread[] = Array.isArray(data.chats) ? data.chats : [];
      setChats(list);
      setSelectedId(prev => {
        if (prev && list.some(c => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setError('Failed to connect to live chats API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchChats(false);
    const interval = window.setInterval(() => {
      void fetchChats(true);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [fetchChats]);

  const activeThread = useMemo(
    () => chats.find(c => c.id === selectedId) ?? null,
    [chats, selectedId]
  );

  useEffect(() => {
    if (activeThread) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.id, activeThread?.messages.length]);

  const handleToggleRead = async (thread: ChatThread, unreadByAdmin: boolean) => {
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unreadByAdmin }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data.thread) {
        setChats(prev => prev.map(c => (c.id === thread.id ? data.thread : c)));
      }
    } catch {
      // Ignore toggle error
    }
  };

  const handleSelectThread = (thread: ChatThread) => {
    setSelectedId(thread.id);
    if (thread.unreadByAdmin) {
      void handleToggleRead(thread, false);
    }
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeThread || !replyText.trim() || sending) return;

    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(activeThread.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data.thread) {
        setError(data?.error || 'Failed to send reply.');
        return;
      }

      setReplyText('');
      const updated: ChatThread = data.thread;
      setChats(prev => [updated, ...prev.filter(c => c.id !== updated.id)]);
    } catch {
      setError('Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setChats(prev => {
          const next = prev.filter(c => c.id !== threadId);
          if (selectedId === threadId) {
            setSelectedId(next[0]?.id ?? null);
          }
          return next;
        });
      }
    } catch {
      setError('Failed to delete conversation.');
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Loading live visitor chats...
      </div>
    );
  }

  const unreadCount = chats.filter(c => c.unreadByAdmin).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <MessageCircle className="h-5 w-5 text-amber-400" />
            Visitor Live Chats ({chats.length})
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                {unreadCount} unread
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-400">
            Visitors persist without signing up via cookies and browser storage, synced to MongoDB here.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchChats(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {chats.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-10 text-center text-sm text-zinc-400">
          No visitor live chats yet. When someone sends a message from the homepage chat bubble, it will appear here.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Conversation List */}
          <div className="space-y-2.5 lg:col-span-5">
            {chats.map(thread => {
              const lastMsg = thread.messages[thread.messages.length - 1];
              const isSelected = thread.id === activeThread?.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleSelectThread(thread)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-amber-400/50 bg-zinc-900 ring-1 ring-amber-400/20'
                      : thread.unreadByAdmin
                      ? 'border-amber-400/25 bg-amber-400/5 hover:border-amber-400/40'
                      : 'border-white/10 bg-zinc-900/60 hover:border-white/20 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {thread.visitorName || 'Visitor'}
                        </span>
                        {thread.unreadByAdmin && (
                          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-zinc-950">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'} · Updated{' '}
                        {formatTimestamp(thread.updatedAt)}
                      </p>
                    </div>
                  </div>
                  {lastMsg && (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-300">
                      <span className="text-zinc-500">
                        {lastMsg.sender === 'admin' ? 'You: ' : ''}
                      </span>
                      {lastMsg.text}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Thread & Reply Panel */}
          <div className="lg:col-span-7">
            {activeThread ? (
              <div className="flex h-[540px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70">
                {/* Thread Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900 px-5 py-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {activeThread.visitorName || 'Visitor'}
                    </h3>
                    <p className="truncate text-[11px] font-mono text-zinc-500">
                      Session {activeThread.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleToggleRead(activeThread, !activeThread.unreadByAdmin)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                      {activeThread.unreadByAdmin ? 'Mark Read' : 'Mark Unread'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteThread(activeThread.id)}
                      aria-label="Delete conversation"
                      className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  {activeThread.messages.map(msg => {
                    const isAdmin = msg.sender === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isAdmin
                              ? 'rounded-br-sm border border-amber-400/30 bg-amber-400/15 text-amber-50'
                              : 'rounded-bl-sm border border-white/10 bg-zinc-950 text-zinc-200'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="mt-1 px-1 text-[11px] text-zinc-500">
                          {isAdmin ? 'You (Admin)' : activeThread.visitorName || 'Visitor'} ·{' '}
                          {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply Box */}
                <form
                  onSubmit={handleSendReply}
                  className="flex items-end gap-2.5 border-t border-white/10 bg-zinc-900 px-4 py-3"
                >
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendReply();
                      }
                    }}
                    placeholder="Reply to visitor..."
                    aria-label="Reply to visitor"
                    className="flex-1 resize-none rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || sending}
                    className="inline-flex h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                    <span>{sending ? 'Sending...' : 'Reply'}</span>
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
