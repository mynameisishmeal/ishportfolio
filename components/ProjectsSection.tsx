'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { PROJECT_STATUS_META, toSafeHttpUrl } from '@/lib/format';
import { ProjectItem, ProjectStatus } from '@/lib/types';
import MotionReveal from './MotionReveal';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  Github,
  Layers,
  X,
} from 'lucide-react';

const PROJECTS_PER_PAGE = 3;

const STATUS_FILTERS: { id: 'all' | ProjectStatus; label: string }[] = [
  { id: 'all', label: 'All Projects' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'live', label: 'Live' },
  { id: 'completed', label: 'Completed' },
];

export default function ProjectsSection() {
  const { projects } = useStore();
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(projects.map(p => p.category).filter(Boolean)));
    return ['all', ...unique];
  }, [projects]);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      return true;
    });
  }, [projects, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PROJECTS_PER_PAGE;
  const paginatedProjects = filtered.slice(startIndex, startIndex + PROJECTS_PER_PAGE);

  const handlePageChange = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (clamped === safePage) return;
    setCurrentPage(clamped);
    const scroller = document.querySelector<HTMLDivElement>('[data-book-scroll="projects"]');
    scroller?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section id="projects" className="overflow-x-clip px-6 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <MotionReveal mode="scroll">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono-code mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-300">
                <FolderGit2 className="h-3.5 w-3.5" />
                <span>Projects</span>
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                What I&apos;m Working On &amp; Shipped
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-400 sm:text-base">
                Active builds, recent client platforms, and tools I&apos;ve developed.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white sm:self-auto"
            >
              <span>+ Add / Edit Projects</span>
            </Link>
          </div>
        </MotionReveal>

        {/* Filters */}
        <MotionReveal mode="scroll" delay={0.08}>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(tab => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      active
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {categories.length > 2 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={e => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter projects by category"
                  className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-400/50"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </MotionReveal>

        {/* Outer Projects Container Card */}
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-zinc-900/45 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3.5">
            <span className="font-mono-code text-xs text-zinc-400">
              {filtered.length === 0
                ? '0 projects'
                : `Showing ${startIndex + 1}–${Math.min(
                    startIndex + PROJECTS_PER_PAGE,
                    filtered.length
                  )} of ${filtered.length} projects`}
            </span>
            {totalPages > 1 ? (
              <span className="font-mono-code text-xs text-amber-300/90">
                Page {safePage} / {totalPages}
              </span>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/50 p-10 text-center">
              <Layers className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-300">No projects match this filter.</p>
              <p className="mt-1 text-xs text-zinc-500">
                Add a new project from the Admin dashboard or switch filters above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {paginatedProjects.map((project, idx) => {
                const statusMeta =
                  PROJECT_STATUS_META[project.status] || PROJECT_STATUS_META.in_progress;
                return (
                  <MotionReveal
                    key={`${safePage}-${project.id}`}
                    mode="mount"
                    delay={idx * 0.06}
                    randomJitterMax={0.03}
                    className="h-full"
                  >
                    <article
                      onClick={() => setSelectedProject(project)}
                      className="group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/75 transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-zinc-950"
                    >
                      <div>
                        {project.imageUrl ? (
                          <div className="aspect-[16/9] w-full overflow-hidden border-b border-white/[0.06] bg-zinc-950">
                            <img
                              src={project.imageUrl}
                              alt={project.title}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            />
                          </div>
                        ) : null}

                        <div className="p-7 sm:p-6">
                          <div className="mb-3.5 flex items-center justify-between gap-2">
                            <span
                              style={{
                                background: statusMeta.bg,
                                borderColor: statusMeta.border,
                                color: statusMeta.text,
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                            >
                              <span
                                style={{ background: statusMeta.dotColor }}
                                className="h-1.5 w-1.5 rounded-full"
                              />
                              {statusMeta.label}
                            </span>

                            <span className="font-mono-code text-[11px] text-zinc-400">
                              {project.category}
                            </span>
                          </div>

                          <h3 className="font-display text-lg font-bold text-zinc-100 transition group-hover:text-amber-200">
                            {project.title}
                          </h3>

                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                            {project.tagline || project.description}
                          </p>

                          {project.techStack.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {project.techStack.slice(0, 4).map(tech => (
                                <span
                                  key={tech}
                                  className="font-mono-code rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-300"
                                >
                                  {tech}
                                </span>
                              ))}
                              {project.techStack.length > 4 && (
                                <span className="font-mono-code rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500">
                                  +{project.techStack.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/[0.06] px-7 py-4 sm:px-6 sm:py-3.5">
                        <span className="text-xs font-medium text-zinc-300 group-hover:text-amber-300">
                          View details
                        </span>

                        <div
                          className="flex items-center gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {toSafeHttpUrl(project.repoUrl) ? (
                            <a
                              href={toSafeHttpUrl(project.repoUrl)!}
                              target="_blank"
                              rel="noreferrer"
                              title="Source Repository"
                              className="rounded-lg border border-white/10 p-1.5 text-zinc-400 transition hover:border-white/25 hover:text-white"
                            >
                              <Github className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                          {toSafeHttpUrl(project.liveUrl) ? (
                            <a
                              href={toSafeHttpUrl(project.liveUrl)!}
                              target="_blank"
                              rel="noreferrer"
                              title="Live Demo"
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-400/20"
                            >
                              <span>Live</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          ) : null}
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
                      aria-label={`Projects page ${pageNum}`}
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
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div
          data-modal-open="true"
          onClick={() => setSelectedProject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    style={{
                      background: PROJECT_STATUS_META[selectedProject.status]?.bg,
                      borderColor: PROJECT_STATUS_META[selectedProject.status]?.border,
                      color: PROJECT_STATUS_META[selectedProject.status]?.text,
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  >
                    <span
                      style={{
                        background: PROJECT_STATUS_META[selectedProject.status]?.dotColor,
                      }}
                      className="h-1.5 w-1.5 rounded-full"
                    />
                    {PROJECT_STATUS_META[selectedProject.status]?.label}
                  </span>
                  <span className="font-mono-code text-xs text-zinc-400">
                    {selectedProject.category}
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold text-zinc-100">
                  {selectedProject.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                aria-label="Close project details"
                className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedProject.imageUrl ? (
              <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                <img
                  src={selectedProject.imageUrl}
                  alt={selectedProject.title}
                  className="max-h-72 w-full object-cover"
                />
              </div>
            ) : null}

            <p className="mt-5 text-sm leading-relaxed text-zinc-300">
              {selectedProject.description || selectedProject.tagline}
            </p>

            {selectedProject.highlights.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Key Highlights
                </h4>
                <ul className="mt-3 space-y-2">
                  {selectedProject.highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedProject.techStack.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Tech Stack
                </h4>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {selectedProject.techStack.map(tech => (
                    <span
                      key={tech}
                      className="font-mono-code rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-200"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(toSafeHttpUrl(selectedProject.liveUrl) || toSafeHttpUrl(selectedProject.repoUrl)) && (
              <div className="mt-7 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                {toSafeHttpUrl(selectedProject.liveUrl) ? (
                  <a
                    href={toSafeHttpUrl(selectedProject.liveUrl)!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
                  >
                    <span>Open Live Project</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
                {toSafeHttpUrl(selectedProject.repoUrl) ? (
                  <a
                    href={toSafeHttpUrl(selectedProject.repoUrl)!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
                  >
                    <Github className="h-4 w-4" />
                    <span>View Repository</span>
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
