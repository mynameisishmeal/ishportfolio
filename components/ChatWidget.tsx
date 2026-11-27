'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, User, X } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { ChatMessage } from '@/lib/types';

const CHAT_STORAGE_KEY = 'ish_chat_state_v1';
const CHAT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

interface LocalChatMessage extends ChatMessage {
  pending?: boolean;
}

interface StoredChatState {
  chatId: string;
  visitorName: string;
  messages: LocalChatMessage[];
  lastSeenAdminCount?: number;
}

type SyncState = 'idle' | 'synced' | 'offline';

function makeRandomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

function isValidId(value?: string | null): value is string {
  return Boolean(value && CHAT_ID_PATTERN.test(value.trim()));
}

function readLocalState(): StoredChatState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredChatState>;
    if (!isValidId(parsed.chatId)) return null;
    return {
      chatId: parsed.chatId,
      visitorName: typeof parsed.visitorName === 'string' ? parsed.visitorName : '',
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      lastSeenAdminCount:
        typeof parsed.lastSeenAdminCount === 'number' ? parsed.lastSeenAdminCount : 0,
    };
  } catch {
    return null;
  }
}

function writeLocalState(state: StoredChatState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatWidget() {
  const { profile, isCartOpen, completedOrder } = useStore();
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatId, setChatId] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [lastSeenAdminCount, setLastSeenAdminCount] = useState(0);
  const [draft, setDraft] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [rateLimitMsg, setRateLimitMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<LocalChatMessage[]>([]);
  const visitorNameRef = useRef('');
  const syncingPendingRef = useRef(false);

  messagesRef.current = messages;
  visitorNameRef.current = visitorName;

  const ownerName = profile.name || 'Ishmeal';

  const adminMessageCount = useMemo(
    () => messages.filter(m => m.sender === 'admin').length,
    [messages]
  );
  const unreadReplies = Math.max(0, adminMessageCount - lastSeenAdminCount);

  const persist = useCallback((next: StoredChatState) => {
    writeLocalState(next);
  }, []);

  const flushPendingMessages = useCallback(
    async (activeChatId: string, pendingList: LocalChatMessage[]) => {
      if (syncingPendingRef.current || pendingList.length === 0) return;
      syncingPendingRef.current = true;
      try {
        for (const msg of pendingList) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: activeChatId,
              visitorName: visitorNameRef.current.trim(),
              text: msg.text,
              messageId: msg.id,
            }),
          });
          if (!res.ok) break;
          const data = await res.json();
          if (data?.success && data?.thread?.messages) {
            const serverMsgs: LocalChatMessage[] = data.thread.messages.map(
              (m: ChatMessage) => ({ ...m, pending: false })
            );
            setMessages(prev => {
              const serverIds = new Set(serverMsgs.map(m => m.id));
              const remainingPending = prev.filter(
                m => m.pending && !serverIds.has(m.id)
              );
              return [...serverMsgs, ...remainingPending];
            });
            setSyncState('synced');
          }
        }
      } catch {
        // Keep pending locally
      } finally {
        syncingPendingRef.current = false;
      }
    },
    []
  );

  const syncFromServer = useCallback(
    async () => {
      try {
        const res = await fetch('/api/chat', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          setSyncState('offline');
          return;
        }

        const serverChatId = isValidId(data.chatId) ? data.chatId : '';
        if (serverChatId) {
          setChatId(prev => (prev === serverChatId ? prev : serverChatId));
        }

        setSyncState('synced');
        if (data.thread) {
          const serverMsgs: LocalChatMessage[] = (data.thread.messages || []).map(
            (m: ChatMessage) => ({ ...m, pending: false })
          );
          const serverIds = new Set(serverMsgs.map(m => m.id));
          const localPending = messagesRef.current.filter(
            m => m.pending && !serverIds.has(m.id)
          );
          const merged = [...serverMsgs, ...localPending];

          setMessages(merged);
          if (
            !visitorNameRef.current &&
            data.thread.visitorName &&
            data.thread.visitorName !== 'Visitor'
          ) {
            setVisitorName(data.thread.visitorName);
          }

          if (localPending.length > 0 && serverChatId) {
            void flushPendingMessages(serverChatId, localPending);
          }
        } else if (messagesRef.current.some(m => m.pending) && serverChatId) {
          const pendingOnly = messagesRef.current.filter(m => m.pending);
          void flushPendingMessages(serverChatId, pendingOnly);
        }
      } catch {
        setSyncState('offline');
      }
    },
    [flushPendingMessages]
  );

  // Hydrate cached chat state from localStorage, then sync authoritative signed session from server
  useEffect(() => {
    const local = readLocalState();
    const resolvedId = (local && isValidId(local.chatId) && local.chatId) || makeRandomId('chat');

    const initialName = local?.visitorName || '';
    const initialMessages = local?.messages || [];
    const initialSeenCount = local?.lastSeenAdminCount || 0;

    messagesRef.current = initialMessages;
    visitorNameRef.current = initialName;

    setChatId(resolvedId);
    setVisitorName(initialName);
    setMessages(initialMessages);
    setLastSeenAdminCount(initialSeenCount);
    persist({
      chatId: resolvedId,
      visitorName: initialName,
      messages: initialMessages,
      lastSeenAdminCount: initialSeenCount,
    });
    setHydrated(true);

    void syncFromServer();
  }, [persist, syncFromServer]);

  // Persist every message/name/seen-count update to both localStorage and cookie
  useEffect(() => {
    if (!hydrated || !chatId) return;
    persist({
      chatId,
      visitorName,
      messages,
      lastSeenAdminCount,
    });
  }, [hydrated, chatId, visitorName, messages, lastSeenAdminCount, persist]);

  // Mark admin replies as seen when widget is open
  useEffect(() => {
    if (isOpen && adminMessageCount > lastSeenAdminCount) {
      setLastSeenAdminCount(adminMessageCount);
    }
  }, [isOpen, adminMessageCount, lastSeenAdminCount]);

  // Auto-scroll to latest message when opened or updated
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  // Poll for admin replies & sync when open (or lightly when closed if thread exists)
  useEffect(() => {
    if (!hydrated || !chatId) return;
    if (!isOpen && messages.length === 0) return;

    const intervalMs = isOpen ? 5000 : 15000;
    const timer = window.setInterval(() => {
      void syncFromServer();
    }, intervalMs);

    const onFocus = () => {
      void syncFromServer();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [hydrated, chatId, isOpen, messages.length, syncFromServer]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !chatId || sending) return;

    const messageId = makeRandomId('cmsg');
    const optimistic: LocalChatMessage = {
      id: messageId,
      sender: 'visitor',
      text: trimmed,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setDraft('');
    setSending(true);
    setRateLimitMsg('');
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          visitorName: visitorName.trim(),
          text: trimmed,
          messageId,
          website,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.thread?.messages) {
        setSyncState('synced');
        const serverMsgs: LocalChatMessage[] = data.thread.messages.map(
          (m: ChatMessage) => ({ ...m, pending: false })
        );
        const serverIds = new Set(serverMsgs.map(m => m.id));
        setMessages(prev => {
          const otherPending = prev.filter(
            m => m.pending && m.id !== messageId && !serverIds.has(m.id)
          );
          return [...serverMsgs, ...otherPending];
        });
      } else if (res.status === 429 || res.status === 400) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setDraft(trimmed);
        setRateLimitMsg(data?.error || 'Rate limit reached. Please wait a moment.');
      } else {
        setSyncState('offline');
      }
    } catch {
      setSyncState('offline');
    } finally {
      setSending(false);
    }
  };

  if (!hydrated || isCartOpen || completedOrder) {
    return null;
  }

  return (
    <div
      className="fixed bottom-16 right-4 z-40 sm:right-6"
      data-modal-open={isOpen ? 'true' : undefined}
    >
      {isOpen ? (
        <div
          role="dialog"
          aria-label={`Live chat with ${ownerName}`}
          onWheel={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Escape') setIsOpen(false);
            e.stopPropagation();
          }}
          className="flex h-[min(510px,calc(100dvh-6rem))] w-[min(calc(100vw-2rem),375px)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 shadow-2xl shadow-black/70 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/90 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  Chat with {ownerName}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      syncState === 'offline' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  {syncState === 'offline'
                    ? 'Saved locally (retrying sync)'
                    : 'No signup needed — saved in browser'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Optional visitor name strip */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/50 px-3.5 py-2">
            <User className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={visitorName}
              onChange={e => setVisitorName(e.target.value)}
              maxLength={60}
              placeholder="Your name (optional)"
              aria-label="Your name"
              className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
            />
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4 text-xs leading-relaxed text-zinc-300">
                <p className="font-medium text-white">Send a quick message</p>
                <p className="mt-1 text-zinc-400">
                  Ask about a project, product, or custom build. Your conversation
                  stays saved here when you close and reopen your browser.
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isVisitor = msg.sender === 'visitor';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isVisitor
                          ? 'rounded-br-sm bg-amber-400 text-zinc-950 font-medium'
                          : 'rounded-bl-sm border border-white/10 bg-zinc-900 text-zinc-100'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-zinc-500">
                      {isVisitor ? 'You' : ownerName} · {formatMessageTime(msg.createdAt)}
                      {msg.pending ? ' · Pending sync' : ''}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          {rateLimitMsg ? (
            <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-300">
              {rateLimitMsg}
            </div>
          ) : null}
          <form
            onSubmit={handleSend}
            className="flex items-end gap-2 border-t border-white/10 bg-zinc-900/80 p-3"
          >
            <div className="sr-only" aria-hidden="true">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>
            <textarea
              rows={1}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Write a message..."
              aria-label="Write a chat message"
              className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send chat message"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setLastSeenAdminCount(adminMessageCount);
            void syncFromServer();
          }}
          aria-label={`Open live chat with ${ownerName}`}
          className="relative flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-lg shadow-amber-400/25 ring-1 ring-amber-300/60 transition-transform hover:scale-[1.03] hover:bg-amber-300 active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Chat</span>
          {unreadReplies > 0 && (
            <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-950 px-1 text-[10px] font-bold text-amber-400">
              {unreadReplies}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
