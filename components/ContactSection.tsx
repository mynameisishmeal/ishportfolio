'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { toSafeHttpUrl } from '@/lib/format';
import MotionReveal from './MotionReveal';
import { CheckCircle2, Github, Mail, MessageSquare, Send } from 'lucide-react';

export default function ContactSection() {
  const { profile } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Project Inquiry');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Could not send message. Please try again.');
      } else {
        setSent(true);
        setName('');
        setEmail('');
        setMessage('');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="overflow-x-clip px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left: Direct Channels */}
          <div className="lg:col-span-5">
            <MotionReveal mode="scroll">
              <div className="font-mono-code mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-300">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Contact</span>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                Get in Touch
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                Have a project idea, want a custom build, or have a question about something in the shop? Send a message below.
              </p>
            </MotionReveal>

            <div className="mt-8 space-y-3">
              {profile.email ? (
                <MotionReveal mode="scroll" delay={0.06}>
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4 transition hover:border-white/20"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400">Email</div>
                      <div className="text-sm font-medium text-zinc-100">{profile.email}</div>
                    </div>
                  </a>
                </MotionReveal>
              ) : null}

              {toSafeHttpUrl(profile.githubUrl) ? (
                <MotionReveal mode="scroll" delay={0.12}>
                  <a
                    href={toSafeHttpUrl(profile.githubUrl)!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4 transition hover:border-white/20"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-200">
                      <Github className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400">GitHub</div>
                      <div className="text-sm font-medium text-zinc-100">
                        {profile.githubUrl.replace(/^https?:\/\//, '')}
                      </div>
                    </div>
                  </a>
                </MotionReveal>
              ) : null}

              {profile.telegramHandle ? (
                <MotionReveal mode="scroll" delay={0.18}>
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05] text-zinc-200">
                      <Send className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400">Telegram</div>
                      <div className="text-sm font-medium text-zinc-100">{profile.telegramHandle}</div>
                    </div>
                  </div>
                </MotionReveal>
              ) : null}
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="lg:col-span-7">
            <MotionReveal mode="scroll" delay={0.1}>
              <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/55 p-6 sm:p-8">
              {sent ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                  <h3 className="font-display mt-3 text-xl font-bold text-zinc-100">
                    Message Sent
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    Thanks for reaching out. Your message has been saved and I&apos;ll reply soon.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-6 rounded-xl border border-white/15 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 cursor-pointer"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Anti-bot honeypot field (hidden from real visitors) */}
                  <div className="sr-only" aria-hidden="true">
                    <label htmlFor="contact-website-hp">Website</label>
                    <input
                      id="contact-website-hp"
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                      Topic
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Project inquiry, custom build, product question..."
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                      Message
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Tell me about your project or what you need..."
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/60"
                    />
                  </div>

                  {errorMsg ? (
                    <p className="text-xs text-red-400">{errorMsg}</p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </form>
              )}
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
