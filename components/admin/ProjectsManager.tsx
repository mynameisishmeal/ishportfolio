'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/context/StoreContext';
import { PROJECT_STATUS_META } from '@/lib/format';
import { ProjectItem, ProjectStatus } from '@/lib/types';
import ImageUploadField from './ImageUploadField';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Github,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

interface ProjectFormState {
  title: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  category: string;
  techStackText: string;
  highlightsText: string;
  imageUrl: string;
  liveUrl: string;
  repoUrl: string;
  featured: boolean;
}

const EMPTY_FORM: ProjectFormState = {
  title: '',
  tagline: '',
  description: '',
  status: 'in_progress',
  category: 'Web App',
  techStackText: '',
  highlightsText: '',
  imageUrl: '',
  liveUrl: '',
  repoUrl: '',
  featured: false,
};

function toFormState(proj: ProjectItem): ProjectFormState {
  return {
    title: proj.title,
    tagline: proj.tagline,
    description: proj.description,
    status: proj.status,
    category: proj.category,
    techStackText: proj.techStack.join(', '),
    highlightsText: proj.highlights.join('\n'),
    imageUrl: proj.imageUrl || '',
    liveUrl: proj.liveUrl || '',
    repoUrl: proj.repoUrl || '',
    featured: proj.featured,
  };
}

export default function ProjectsManager() {
  const { projects, refreshProjects } = useStore();
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slide, setSlide] = useState<0 | 1>(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const goToSlide = (target: 0 | 1) => {
    if (target === slide) return;
    setFeedback(null);
    setSlideDir(target > slide ? 1 : -1);
    setSlide(target);
  };

  const startEdit = (proj: ProjectItem) => {
    setEditingId(proj.id);
    setForm(toFormState(proj));
    setSlideDir(-1);
    setSlide(0);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlideDir(-1);
    setSlide(0);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slide === 0) {
      return;
    }
    if (!form.title.trim()) {
      setFeedback({ type: 'err', text: 'Project title is required in 1. Basics before saving.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      title: form.title,
      tagline: form.tagline,
      description: form.description,
      status: form.status,
      category: form.category || 'General',
      techStack: form.techStackText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      highlights: form.highlightsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      imageUrl: form.imageUrl,
      liveUrl: form.liveUrl,
      repoUrl: form.repoUrl,
      featured: form.featured,
    };

    try {
      const url = editingId ? `/api/projects/${editingId}` : '/api/projects';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: 'err', text: data.error || 'Could not save project.' });
      } else {
        await refreshProjects();
        setForm(EMPTY_FORM);
        setEditingId(null);
        setSlideDir(-1);
        setSlide(0);
        setFeedback({
          type: 'ok',
          text: editingId ? 'Project updated.' : 'New project added to portfolio.',
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error while saving project.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete project "${title}"?`)) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (editingId === id) cancelEdit();
        await refreshProjects();
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* 2-Slide Add / Edit Project Card */}
      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">
              {editingId ? 'Edit Project' : 'Add New Project'}
            </h2>
            <p className="text-xs text-zinc-400">
              Add a project you&apos;re working on or update an existing build.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Slide Switcher Pills */}
            <div className="inline-flex rounded-xl border border-white/10 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => goToSlide(0)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  slide === 0
                    ? 'bg-amber-400 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                1. Basics
              </button>
              <button
                type="button"
                onClick={() => goToSlide(1)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  slide === 1
                    ? 'bg-amber-400 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                2. Stack &amp; Media
              </button>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {slide === 0 ? (
            <motion.div
              key="project-slide-1"
              initial={{ opacity: 0, x: slideDir > 0 ? 32 : -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDir > 0 ? -32 : 32 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Nigerian Languages Dictionary"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                    >
                      <option value="in_progress">In Progress</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                      Category
                    </label>
                    <input
                      type="text"
                      list="project-category-suggestions"
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      placeholder="Web App, SaaS, Mobile..."
                      className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                    />
                    <datalist id="project-category-suggestions">
                      <option value="Web App" />
                      <option value="Business / POS" />
                      <option value="Fintech" />
                      <option value="Security & QA" />
                      <option value="Mobile App" />
                      <option value="Open Source" />
                    </datalist>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Short Tagline
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={e => setForm({ ...form, tagline: e.target.value })}
                    placeholder="One-line summary shown on the project card..."
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Full Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="What does it do, what problem does it solve, and what are you building right now?"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
                <span className="font-mono-code text-xs text-zinc-500">Slide 1 / 2 · Project Info</span>
                <button
                  type="button"
                  onClick={() => goToSlide(1)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 cursor-pointer"
                >
                  <span>Next: Stack &amp; Media</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="project-slide-2"
              initial={{ opacity: 0, x: slideDir > 0 ? 32 : -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDir > 0 ? -32 : 32 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Tech Stack (comma separated)
                  </label>
                  <input
                    type="text"
                    value={form.techStackText}
                    onChange={e => setForm({ ...form, techStackText: e.target.value })}
                    placeholder="Next.js, TypeScript, PostgreSQL, Tailwind"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Key Highlights (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={form.highlightsText}
                    onChange={e => setForm({ ...form, highlightsText: e.target.value })}
                    placeholder={'Fast full-text search\nRole-based admin dashboard'}
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Live Demo URL (optional)
                  </label>
                  <input
                    type="url"
                    value={form.liveUrl}
                    onChange={e => setForm({ ...form, liveUrl: e.target.value })}
                    placeholder="https://myproject.com"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Repository / GitHub URL (optional)
                  </label>
                  <input
                    type="url"
                    value={form.repoUrl}
                    onChange={e => setForm({ ...form, repoUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <ImageUploadField
                    value={form.imageUrl}
                    onChange={url => setForm({ ...form, imageUrl: url })}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => goToSlide(0)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>

                  <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={e => setForm({ ...form, featured: e.target.checked })}
                      className="h-4 w-4 accent-amber-400"
                    />
                    <span>Feature this project</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Project'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* Existing Projects List */}
      <div>
        <h3 className="font-display mb-4 text-base font-bold text-zinc-200">
          Your Projects ({projects.length})
        </h3>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
            No projects yet. Add your first project above.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map(proj => {
              const statusMeta = PROJECT_STATUS_META[proj.status] || PROJECT_STATUS_META.in_progress;
              return (
                <div
                  key={proj.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-100">{proj.title}</span>
                      <span
                        style={{
                          background: statusMeta.bg,
                          borderColor: statusMeta.border,
                          color: statusMeta.text,
                        }}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      >
                        {statusMeta.label}
                      </span>
                      <span className="font-mono-code text-[11px] text-zinc-500">
                        {proj.category}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-400">
                      {proj.tagline || proj.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {proj.liveUrl ? (
                      <a
                        href={proj.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
                        title="Live link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {proj.repoUrl ? (
                      <a
                        href={proj.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
                        title="Repository link"
                      >
                        <Github className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEdit(proj)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(proj.id, proj.title)}
                      aria-label={`Delete ${proj.title}`}
                      className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
