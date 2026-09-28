import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowUpRight, LayoutGrid, List, Search, X } from 'lucide-react';
import {
  CATEGORIES,
  DEFAULT_FILTERS,
  PROGRAM_LABELS,
  builderLabel,
  filterRepositories,
  loadCatalog,
  pageWindow,
  paginate,
  readParams,
  sortRepositories,
  timeAgo,
  writeParams,
  type Builder,
  type Filters,
  type Repository,
} from '../lib/catalog';

// Los programas regionales se derivan de los datos, no se escriben a mano:
// una lista fija se desincroniza de `programs` y el filtro queda muerto.
const BASE_PROGRAMS = [
  { value: 'all', label: 'All programs' },
  { value: 'scf', label: 'Stellar Community Fund' },
  { value: 'hackathon', label: 'Hackathons' },
];

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'experimental', label: 'Experimental' },
];

const SORTS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'stars', label: 'Most starred' },
  { value: 'az', label: 'A–Z' },
];

const selectCls =
  'bg-white/60 border border-teal-ink/15 rounded-lg text-xs text-teal-ink px-3 py-2.5 outline-none cursor-pointer hover:border-teal-ink/40 focus:border-teal-ink/60 [&>option]:bg-[#ECE0CC]';

function Skeleton() {
  return (
    <div aria-hidden="true" className="border-t border-teal-ink/10">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 py-4 border-b border-teal-ink/5 animate-pulse">
          <div className="col-span-5 h-4 rounded bg-teal-ink/10" />
          <div className="col-span-2 h-4 rounded bg-teal-ink/5" />
          <div className="col-span-2 h-4 rounded bg-teal-ink/5" />
          <div className="col-span-1 h-4 rounded bg-teal-ink/5" />
          <div className="col-span-2 h-4 rounded bg-teal-ink/5" />
        </div>
      ))}
    </div>
  );
}

/**
 * Nombre del builder. Enlace solo si hay perfil verificado: una atribución
 * curada sin URL se muestra como texto plano en vez de apuntar a un perfil
 * de GitHub inventado.
 */
function BuilderTag({ builder, mono = true }: { builder: Builder | null; mono?: boolean }) {
  const label = builderLabel(builder);
  if (!label) return <span className="text-teal-deep/40">—</span>;
  const cls = `${mono ? 'font-mono ' : ''}text-xs text-teal-deep`;
  if (!builder?.url) return <span className={cls}>{label}</span>;
  return (
    <a
      href={builder.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`${cls} underline underline-offset-2 decoration-teal-ink/20 hover:text-clay-deep`}
    >
      {label}
    </a>
  );
}

function RepoDialog({ repo, related, onClose }: { repo: Repository; related: Repository[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const info: [string, string][] = [
    ['Category', repo.category.join(', ')],
    ['Language', repo.primaryLanguage || '—'],
    ['Status', repo.status],
    ['Stars', repo.stars == null ? '—' : String(repo.stars)],
    ['Updated', timeAgo(repo.updatedAt)],
    ['Evidence', repo.evidence || '—'],
    // Solo aparece en entradas curadas a mano: la fuente no publica un motivo.
    ...(repo.curatedNote ? ([['Curated', repo.curatedNote]] as [string, string][]) : []),
  ];
  // El builder no vive en la tabla de info porque necesita ser enlace o texto
  // según haya perfil verificado o no.
  const builder = builderLabel(repo.builder);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={repo.name}
    >
      <div className="absolute inset-0 bg-teal-ink/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="liquid-glass relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-teal-deep/70">Explore / {repo.name}</p>
            <h3 className="mt-1 text-xl font-mono font-semibold break-all text-teal-ink">{repo.name}</h3>
            <p className="mt-2 text-sm text-teal-deep">{repo.description || 'No description on record.'}</p>
            {repo.projectName ? (
              <p className="mt-1 text-xs text-teal-deep/70">
                Project: {repo.projectName}
                {repo.evidence ? ` · evidence: ${repo.evidence}` : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail"
            className="w-9 h-9 shrink-0 rounded-full border border-teal-ink/15 flex items-center justify-center text-teal-deep hover:text-teal-ink hover:border-teal-ink/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={repo.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-clay-deep text-sand text-xs font-semibold px-4 py-2.5 hover:bg-clay"
          >
            View repository <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          {repo.websiteUrl ? (
            <a
              href={repo.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-ink/20 text-xs font-medium px-4 py-2.5 hover:bg-teal-ink/5"
            >
              Visit website <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          ) : null}
        </div>
        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-px bg-teal-ink/10 border border-teal-ink/10 rounded-xl overflow-hidden">
          {info.map(([k, v]) => (
            <div key={k} className="bg-[#ECE0CC] p-3.5">
              <dt className="text-[10px] uppercase tracking-widest text-teal-deep/70">{k}</dt>
              <dd className="mt-1 text-sm font-semibold text-teal-ink">{v}</dd>
            </div>
          ))}
          {builder ? (
            <div className="bg-[#ECE0CC] p-3.5">
              <dt className="text-[10px] uppercase tracking-widest text-teal-deep/70">Builder</dt>
              <dd className="mt-1 text-sm font-semibold text-teal-ink">
                <BuilderTag builder={repo.builder} mono={false} />
              </dd>
            </div>
          ) : null}
        </dl>
        {repo.programs.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-xs uppercase tracking-widest text-teal-deep/70">Funding & programs</h4>
            {repo.programs.includes('scf') ? (
              <p className="mt-2 text-sm text-teal-ink">
                Stellar Community Fund
                {repo.scfTotal != null ? (
                  <span className="text-teal-deep"> · ${repo.scfTotal.toLocaleString('en-US')}</span>
                ) : null}
              </p>
            ) : null}
            {repo.programs
              .filter((p) => p !== 'scf' && p !== 'hackathon')
              .map((p) => (
                <p key={p} className="mt-1.5 text-sm text-teal-ink">
                  {PROGRAM_LABELS[p] || p}
                  <span className="text-teal-deep/70"> · regional program</span>
                </p>
              ))}
            {repo.programs.includes('hackathon') &&
            !repo.programs.some((p) => p !== 'scf' && p !== 'hackathon') ? (
              <p className="mt-1.5 text-sm text-teal-deep">Hackathon builds · see below</p>
            ) : null}
          </div>
        ) : null}
        {repo.builds.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-xs uppercase tracking-widest text-teal-deep/70">
              Hackathon builds ({repo.builds.length})
            </h4>
            <ul className="mt-3 space-y-3">
              {repo.builds.map((b) => (
                <li key={`${b.eventSlug}-${b.name}`} className="rounded-lg border border-teal-ink/10 bg-white/50 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-teal-ink">{b.name}</span>
                    {b.winner ? (
                      <span className="rounded border border-clay-deep/40 text-clay-deep px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Winner
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-teal-deep">
                    {b.event}
                    {b.country ? ` · ${b.country}` : ''}
                    {b.award ? ` · ${b.award}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-teal-deep/70">
                    Built by{' '}
                    {b.builder ? (
                      b.builderUrl ? (
                        <a href={b.builderUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-teal-ink">
                          @{b.builder}
                        </a>
                      ) : (
                        <span className="font-medium text-teal-deep">{b.builder}</span>
                      )
                    ) : (
                      'unknown'
                    )}
                    {b.url ? (
                      <>
                        {' · '}
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-teal-ink">
                          DoraHacks
                        </a>
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {related.length > 0 ? (
          <div className="mt-6">
            <h4 className="text-xs uppercase tracking-widest text-teal-deep/70">Related repositories</h4>
            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              {related.map((r) => (
                <a
                  key={r.slug}
                  href={`?repo=${encodeURIComponent(r.slug)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const url = new URL(window.location.href);
                    url.searchParams.set('repo', r.slug);
                    window.history.replaceState(null, '', url.toString());
                    window.dispatchEvent(new CustomEvent('atlas:open-repo', { detail: r.slug }));
                  }}
                  className="rounded-lg border border-teal-ink/10 bg-white/50 p-3 hover:bg-white/80"
                >
                  <p className="text-xs font-mono font-semibold break-all text-teal-ink">{r.name}</p>
                  <p className="mt-1 text-[11px] text-teal-deep/70 line-clamp-2">{r.description}</p>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

export default function Explorer() {
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState('');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const debounce = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog('./')
      .then(({ repos, languages }) => {
        if (cancelled) return;
        setRepos(repos);
        setLanguages(languages);
        const initial = readParams();
        setFilters(initial);
        setDraft(initial.q);
        const repoParam = new URLSearchParams(window.location.search).get('repo');
        if (repoParam) setOpenSlug(repoParam);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => setOpenSlug((e as CustomEvent<string>).detail);
    window.addEventListener('atlas:open-repo', onOpen);
    return () => window.removeEventListener('atlas:open-repo', onOpen);
  }, []);

  const patch = useCallback((p: Partial<Filters>, resetPage = true) => {
    setFilters((f) => {
      const next = { ...f, ...p, page: resetPage ? 1 : p.page || f.page };
      writeParams(next);
      return next;
    });
  }, []);

  // Presets sent by the mockup above (sidebar, labels): apply + stay on explorer.
  useEffect(() => {
    const onPreset = (e: Event) => {
      const detail = (e as CustomEvent<Partial<Filters>>).detail || {};
      if (detail.q !== undefined) setDraft(detail.q);
      patch(detail);
    };
    window.addEventListener('atlas:preset', onPreset);
    return () => window.removeEventListener('atlas:preset', onPreset);
  }, [patch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onDraft = useCallback(
    (v: string) => {
      setDraft(v);
      if (debounce.current) window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => patch({ q: v.trim() }), 300);
    },
    [patch],
  );

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.q) n++;
    if (filters.category !== 'all') n++;
    if (filters.program !== 'all') n++;
    if (filters.language !== 'all') n++;
    if (filters.status !== 'all') n++;
    return n;
  }, [filters]);

  const result = useMemo(() => {
    if (!repos) return null;
    const filtered = filterRepositories(repos, filters);
    const sorted = sortRepositories(filtered, filters.sort);
    return { filtered, page: paginate(sorted, filters.page, filters.limit) };
  }, [repos, filters]);

  // Programas regionales ordenados por volumen: los que tienen repos van primero.
  const programs = useMemo(() => {
    if (!repos) return BASE_PROGRAMS;
    const counts = new Map<string, number>();
    for (const r of repos) {
      for (const p of r.programs) {
        if (p === 'scf' || p === 'hackathon') continue;
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
    const regional = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, n]) => ({ value, label: `${PROGRAM_LABELS[value] || value} (${n})` }));
    return [...BASE_PROGRAMS, ...regional];
  }, [repos]);

  const openRepo = useMemo(
    () => (openSlug && repos ? repos.find((r) => r.slug === openSlug) || null : null),
    [openSlug, repos],
  );

  const related = useMemo(() => {
    if (!openRepo || !repos) return [];
    // 'Other' es la categoría comodín: coincide con miles de repositorios y
    // produce "relacionados" alfabéticamente arbitrarios. Sin una categoría
    // real solo vale la misma organización.
    const meaningful = openRepo.category.filter((c) => c !== 'Other');
    if (meaningful.length === 0 && !openRepo.organization) return [];
    return repos
      .filter(
        (r) =>
          r.slug !== openRepo.slug &&
          (r.category.some((c) => meaningful.includes(c)) ||
            (r.organization && r.organization === openRepo.organization)),
      )
      .slice(0, 4);
  }, [openRepo, repos]);

  const closeDialog = useCallback(() => {
    setOpenSlug(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('repo');
    window.history.replaceState(null, '', url.toString());
  }, []);

  const openDetail = useCallback((slug: string) => {
    setOpenSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('repo', slug);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const clearAll = useCallback(() => {
    setDraft('');
    setFilters((f) => {
      const next = { ...DEFAULT_FILTERS, view: f.view, limit: f.limit };
      writeParams(next);
      return next;
    });
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-teal-ink/15 bg-white/60 p-12 text-center">
        <h3 className="text-lg font-semibold text-teal-ink">We couldn't load the ecosystem.</h3>
        <p className="mt-2 text-sm text-teal-deep">Try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-full border border-teal-ink/20 px-5 py-2.5 text-sm hover:bg-teal-ink/5"
        >
          Retry
        </button>
      </div>
    );
  }

  const total = result?.page.total || 0;
  const pages = result?.page.pages || 1;
  const win = pageWindow(filters.page, pages);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-teal-ink/25 bg-white/60 px-4 py-1.5 focus-within:border-teal-ink/60 backdrop-blur-sm">
        <Search className="w-4 h-4 text-teal-deep/60 shrink-0" />
        <input
          ref={inputRef}
          id="explorer-search"
          type="search"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          placeholder="Search repositories, projects or builders..."
          aria-label="Search repositories, projects or builders"
          className="flex-1 bg-transparent py-3 text-sm text-teal-ink outline-none placeholder:text-teal-deep/50"
        />
        <kbd className="hidden sm:block font-mono text-[11px] border border-teal-ink/15 rounded px-2 py-1 text-teal-deep/60">
          ⌘ K
        </kbd>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filters">
        <select aria-label="Funding program" value={filters.program} onChange={(e) => patch({ program: e.target.value })} className={selectCls}>
          {programs.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Category" value={filters.category} onChange={(e) => patch({ category: e.target.value })} className={selectCls}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Language" value={filters.language} onChange={(e) => patch({ language: e.target.value })} className={selectCls}>
          <option value="all">All languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={filters.status} onChange={(e) => patch({ status: e.target.value })} className={selectCls}>
          {STATUSES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Sort by" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as Filters['sort'] })} className={selectCls}>
          {SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {activeCount > 0 ? (
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-teal-deep">
          <span>
            {activeCount} active filter{activeCount === 1 ? '' : 's'}:
          </span>
          {filters.q ? <span className="rounded-full border border-teal-ink/15 bg-white/50 px-2.5 py-1">“{filters.q}”</span> : null}
          {(['category', 'program', 'language', 'status'] as const).map((k) =>
            filters[k] !== 'all' ? (
              <span key={k} className="rounded-full border border-teal-ink/15 bg-white/50 px-2.5 py-1">
                {filters[k]}
              </span>
            ) : null,
          )}
          <button type="button" onClick={clearAll} className="rounded-full border border-teal-ink/20 px-3 py-1 hover:bg-teal-ink/5">
            Clear all
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between border-t border-teal-ink/15 pt-4">
        <p className="text-sm font-semibold tabular-nums text-teal-ink" role="status" aria-live="polite">
          {repos === null
            ? 'Loading ecosystem…'
            : activeCount > 0
              ? `${total.toLocaleString('en-US')} repositories matching your search`
              : `${total.toLocaleString('en-US')} repositories`}
        </p>
        <div className="flex rounded-lg border border-teal-ink/15 overflow-hidden bg-white/50" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={filters.view === 'list'}
            onClick={() => patch({ view: 'list' }, false)}
            className={`p-2 ${filters.view === 'list' ? 'bg-teal-ink text-sand' : 'text-teal-deep/60'}`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-pressed={filters.view === 'grid'}
            onClick={() => patch({ view: 'grid' }, false)}
            className={`p-2 ${filters.view === 'grid' ? 'bg-teal-ink text-sand' : 'text-teal-deep/60'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!result ? (
        <Skeleton />
      ) : total === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-teal-ink/20 bg-white/40 p-12 text-center">
          <h3 className="text-lg font-semibold text-teal-ink">No repositories found.</h3>
          <p className="mt-2 text-sm text-teal-deep">Try changing your search or removing some filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-full border border-teal-ink/20 px-5 py-2.5 text-sm hover:bg-teal-ink/5"
          >
            Clear filters
          </button>
        </div>
      ) : filters.view === 'grid' ? (
        <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {result.page.data.map((r) => (
            <button
              key={r.slug}
              type="button"
              onClick={() => openDetail(r.slug)}
              className="liquid-glass rounded-xl p-4 text-left hover:shadow-[0_12px_28px_-16px_rgba(31,53,54,0.4)] transition-shadow"
            >
              <p className="font-mono text-sm font-semibold break-all text-teal-ink">{r.name}</p>
              <p className="mt-1.5 text-xs text-teal-deep line-clamp-3">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-teal-deep">
                {r.programs.map((p) => (
                  <span
                    key={p}
                    className={`rounded border px-1.5 py-0.5 font-bold ${
                      p === 'scf' ? 'border-clay-deep/40 text-clay-deep' : 'border-teal-ink/15'
                    }`}
                  >
                    {PROGRAM_LABELS[p] || p}
                  </span>
                ))}
                <span className="rounded border border-teal-ink/15 px-1.5 py-0.5">{r.category[0]}</span>
                <span>{r.primaryLanguage || '—'}</span>
                <span>{r.stars == null ? '—' : `${r.stars} ★`}</span>
                {r.builder ? <span className="font-mono">by {builderLabel(r.builder)}</span> : null}
                {r.countries.length > 0 ? <span>{r.countries.join(' · ')}</span> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 overflow-x-auto border-t border-teal-ink/15">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-teal-deep/70">
                <th scope="col" className="py-3 pr-4 font-semibold">Project</th>
                <th scope="col" className="py-3 pr-4 font-semibold hidden lg:table-cell">Category</th>
                <th scope="col" className="py-3 pr-4 font-semibold hidden md:table-cell">Program</th>
                <th scope="col" className="py-3 pr-4 font-semibold hidden md:table-cell">Lang</th>
                <th scope="col" className="py-3 pr-4 font-semibold">★</th>
                <th scope="col" className="py-3 pr-4 font-semibold hidden sm:table-cell">Updated</th>
                <th scope="col" className="py-3 font-semibold hidden sm:table-cell">Status</th>
                <th scope="col" className="py-3 pl-4 font-semibold hidden lg:table-cell">Builder</th>
                <th scope="col" className="py-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {result.page.data.map((r) => (
                <tr
                  key={r.slug}
                  onClick={() => openDetail(r.slug)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openDetail(r.slug);
                  }}
                  tabIndex={0}
                  className="group border-t border-teal-ink/10 cursor-pointer hover:bg-teal-ink/[0.04]"
                >
                  <td className="py-3.5 pr-4">
                    <span className="block font-semibold text-teal-ink">{r.name}</span>
                    <span className="block text-xs text-teal-deep line-clamp-2 mt-0.5">{r.description}</span>
                    {r.organization ? <span className="block font-mono text-[11px] text-teal-deep/60 mt-1">{r.organization}</span> : null}
                    <span className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-teal-deep sm:hidden">
                      <span>{r.category[0]}</span>·<span>{r.primaryLanguage || '—'}</span>·
                      <span>{r.stars == null ? '—' : `${r.stars} ★`}</span>
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 text-teal-deep hidden lg:table-cell">
                    {r.category[0]}
                    {r.countries.length > 0 ? (
                      <span className="block text-[11px] text-teal-deep/60">{r.countries.join(' · ')}</span>
                    ) : null}
                  </td>
<td className="py-3.5 pr-4 hidden md:table-cell">
                    {r.programs.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {r.programs.map((p) => (
                          <span
                            key={p}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight ${
                              p === 'scf'
                                ? 'border-clay-deep/40 text-clay-deep bg-clay-deep/5'
                                : 'border-teal-ink/20 text-teal-deep bg-teal-ink/5'
                            }`}
                          >
                            {PROGRAM_LABELS[p] || p}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-teal-deep/40">—</span>
                    )}
                  </td>
                  <td className="py-3.5 pr-4 text-teal-deep hidden md:table-cell">{r.primaryLanguage || '—'}</td>
                  <td className="py-3.5 pr-4 tabular-nums text-teal-ink">{r.stars == null ? '—' : r.stars}</td>
                  <td className="py-3.5 pr-4 text-teal-deep whitespace-nowrap hidden sm:table-cell">{timeAgo(r.updatedAt)}</td>
                  <td className="py-3.5 pr-4 hidden sm:table-cell">
                    <span className="rounded border border-teal-ink/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-teal-deep">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 pl-4 hidden lg:table-cell">
                    <BuilderTag builder={r.builder} />
                  </td>
                  <td className="py-3.5 text-teal-deep/50 group-hover:text-clay-deep group-hover:translate-x-[3px] transition-all">
                    <ArrowUpRight className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && total > 0 ? (
        <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-teal-deep/70 tabular-nums">
            Showing {(result.page.page - 1) * filters.limit + 1}–{Math.min(total, result.page.page * filters.limit)} of{' '}
            {total.toLocaleString('en-US')} · Page {result.page.page} of {pages}
          </p>
          <button
            type="button"
            disabled={filters.page <= 1}
            onClick={() => patch({ page: filters.page - 1 }, false)}
            className="h-10 px-3 rounded-lg border border-teal-ink/15 text-sm text-teal-ink disabled:opacity-40 hover:border-teal-ink/40"
          >
            ← Previous
          </button>
          {win.map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="px-1 text-teal-deep/60" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === filters.page ? 'page' : undefined}
                onClick={() => patch({ page: n }, false)}
                className={`min-w-10 h-10 px-3 rounded-lg border text-sm ${
                  n === filters.page ? 'bg-teal-ink text-sand border-teal-ink' : 'border-teal-ink/15 text-teal-ink hover:border-teal-ink/40'
                }`}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={filters.page >= pages}
            onClick={() => patch({ page: filters.page + 1 }, false)}
            className="h-10 px-3 rounded-lg border border-teal-ink/15 text-sm text-teal-ink disabled:opacity-40 hover:border-teal-ink/40"
          >
            Next →
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-teal-deep/70">
            Results per page
            <select
              value={filters.limit}
              onChange={(e) => patch({ limit: parseInt(e.target.value, 10), page: 1 }, false)}
              className={selectCls}
            >
              {[24, 48, 96].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </nav>
      ) : null}

      {openRepo
        ? createPortal(
            <RepoDialog repo={openRepo} related={related} onClose={closeDialog} />,
            document.body,
          )
        : null}
    </div>
  );
}
