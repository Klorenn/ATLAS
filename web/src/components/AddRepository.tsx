import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, Search } from 'lucide-react';
import { CATEGORIES, COUNTRY_PROGRAMS } from '../lib/catalog';
import {
  ASSIGNABLE_PROGRAMS,
  KNOWN_COUNTRIES,
  analyzeRepo,
  buildEntry,
  crossCheckPassport,
  isInstawards,
  parseRepoInput,
  passportHackathons,
  type CuratedBuilderEntry,
  type CuratedRepository,
  type PassportSnapshot,
  type RepoAnalysis,
} from '../lib/curate';

// Curación de una entrada del catálogo.
//
// El flujo tiene un límite real: esta página prepara y explica, no escribe.
// Atlas es un sitio estático y `data/` es la fuente canónica versionada, así
// que una entrada nueva llega por un commit a `web/data/curated-additions.json`
// y no desde el navegador. Publicar sin revisar es justo lo que este proyecto
// evita: cada registro lleva evidencia de fuente.
//
// Lo que la fuente no publica se muestra como "—" y queda null. Las casillas
// sin marcar no se guardan como false: no se guardan.

const inputCls =
  'w-full bg-white/60 border border-teal-ink/15 rounded-lg text-sm text-teal-ink px-3 py-2.5 outline-none focus:border-teal-ink/60 placeholder:text-teal-deep/40';
const selectCls =
  'w-full bg-white/60 border border-teal-ink/15 rounded-lg text-sm text-teal-ink px-3 py-2.5 outline-none cursor-pointer focus:border-teal-ink/60 [&>option]:bg-[#ECE0CC]';
const labelCls = 'block text-[11px] uppercase tracking-widest text-teal-deep/70 mb-1.5';

const today = () => new Date().toISOString().slice(0, 10);

const empty = '';

export default function AddRepository() {
  const [input, setInput] = useState(empty);
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
  const [passport, setPassport] = useState<PassportSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [programs, setPrograms] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [category, setCategory] = useState(empty);
  const [builderName, setBuilderName] = useState(empty);
  const [note, setNote] = useState(empty);

  const abort = useRef<AbortController | null>(null);

  // El snapshot de Passport es opcional: si el pipeline no lo generó, la
  // curaduría sigue funcionando con los datos de GitHub.
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/passport.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setPassport(json as PassportSnapshot);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => abort.current?.abort(), []);

  const reset = useCallback(() => {
    setAnalysis(null);
    setPrograms([]);
    setCountries([]);
    setCategory(empty);
    setBuilderName(empty);
    setNote(empty);
    setError(null);
    setCopied(false);
  }, []);

  const search = useCallback(async () => {
    const fullName = parseRepoInput(input);
    if (!fullName) {
      setError('Could not read that path. Use `owner/repo` or a full GitHub URL.');
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    reset();

    try {
      const result = await analyzeRepo(fullName, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setAnalysis(result);
      // Una sugerencia, no una clasificación: quien curationa la confirma.
      if (result.categoryHints.length > 0) setCategory(result.categoryHints[0]);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Could not read the repository.');
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, [input, reset]);

  const passportMatch = useMemo(
    () => (analysis ? crossCheckPassport(analysis, passport) : { builder: null, visibility: null }),
    [analysis, passport],
  );

  // InstaWards es un `format` de hackathon en Passport. Al marcarlo se marca el
  // programa, porque en Atlas el filtro se llama así.
  const hackathons = useMemo(() => passportHackathons(passport), [passport]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    setCopied(false);
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const built = useMemo(() => {
    if (!analysis) return null;
    const { repository, builder } = buildEntry({
      analysis,
      builderName: builderName.trim() || null,
      builderLogin: analysis.owner?.login || null,
      builderUrl: analysis.owner ? `https://github.com/${analysis.owner.login}` : null,
      organization: analysis.owner?.type === 'Organization' ? analysis.owner.login : null,
      programs,
      countries,
      category: category || null,
      note,
      observedAt: today(),
    });
    return { repository, builder };
  }, [analysis, programs, countries, category, builderName, note]);

  const payload = useMemo(() => {
    if (!built) return empty;
    const add: Record<string, unknown> = { repositories: [built.repository] };
    if (built.builder) add.builders = [built.builder];
    return JSON.stringify(add, null, 2);
  }, [built]);

  const copy = useCallback(async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
    } catch {
      setError('The browser blocked the clipboard. Copy the block by hand.');
    }
  }, [payload]);

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-widest text-teal-deep">[ Add a repository ]</p>
      <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02] text-teal-ink">
        Add a repository to the catalog.
      </h2>
      <p className="mt-4 text-teal-deep text-base max-w-xl">
        Paste a GitHub path. Atlas reads the repository, proposes a category and builder, and
        assembles the entry with the programs and country you pick.
      </p>

      <div className="mt-8 flex items-center gap-3 rounded-xl border border-teal-ink/25 bg-white/60 px-4 py-1.5 focus-within:border-teal-ink/60 backdrop-blur-sm">
        <Search className="w-4 h-4 text-teal-deep/60 shrink-0" />
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
          placeholder="owner/repo or https://github.com/owner/repo"
          aria-label="Repository path"
          className="flex-1 bg-transparent py-3 text-sm text-teal-ink outline-none placeholder:text-teal-deep/50"
        />
        <button
          type="button"
          onClick={search}
          disabled={busy || !input.trim()}
          className="shrink-0 rounded-full bg-clay-deep text-sand text-xs font-semibold px-4 py-2 hover:bg-clay disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Analyze'}
        </button>
      </div>

      {passport ? (
        <p className="mt-2 text-xs text-teal-deep/70">
          Passport synced {passport.observedAt} · {passport.counts.builders} builders ·{' '}
          {passport.counts.hackathons} hackathons
        </p>
      ) : (
        <p className="mt-2 text-xs text-teal-deep/70">
          No Passport snapshot. Run <code className="font-mono">npm run passport</code> to match
          against builder profiles.
        </p>
      )}

      {error ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-clay-deep/40 bg-clay-deep/5 px-4 py-3 text-sm text-clay-deep">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </p>
      ) : null}

      {analysis && built ? (
        <div className="mt-8 space-y-6">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-teal-ink/10 border border-teal-ink/10 rounded-xl overflow-hidden">
            {(
              [
                ['Repository', analysis.fullName],
                ['Language', analysis.language || '—'],
                ['Stars', analysis.stars == null ? '—' : String(analysis.stars)],
                ['Last push', analysis.pushedAt ? analysis.pushedAt.slice(0, 10) : '—'],
                ['License', analysis.license || '—'],
                ['Archived', analysis.archived ? 'yes' : 'no'],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="bg-[#ECE0CC] p-3.5">
                <dt className="text-[10px] uppercase tracking-widest text-teal-deep/70">{k}</dt>
                <dd className="mt-1 text-sm font-semibold text-teal-ink break-all">{v}</dd>
              </div>
            ))}
          </dl>

          {analysis.topics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {analysis.topics.map((t) => (
                <span key={t} className="rounded border border-teal-ink/15 px-2 py-0.5 text-[11px] text-teal-deep">
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {passportMatch.builder ? (
            <div className="rounded-xl border border-teal-ink/15 bg-white/50 p-4">
              <p className="text-[11px] uppercase tracking-widest text-teal-deep/70">Passport match</p>
              <p className="mt-1.5 text-sm text-teal-ink">
                {passportMatch.builder.displayName || `@${passportMatch.builder.githubUsername}`}
                {passportMatch.builder.stellarAddress ? (
                  <span className="text-teal-deep"> · {passportMatch.builder.stellarAddress}</span>
                ) : null}
              </p>
              {passportMatch.visibility ? (
                <p className="mt-1 text-xs text-teal-deep/70">
                  Passport declara qué campos son públicos. Lo no declarado no se muestra.
                </p>
              ) : null}
            </div>
          ) : null}

          <fieldset>
            <legend className={labelCls}>Programs</legend>
            <div className="flex flex-wrap gap-2">
              {ASSIGNABLE_PROGRAMS.map((p) => {
                const on = programs.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(programs, setPrograms, p.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      on
                        ? 'border-clay-deep bg-clay-deep text-sand'
                        : 'border-teal-ink/20 text-teal-deep hover:bg-teal-ink/5'
                    }`}
                  >
                    {on ? <Check className="w-3 h-3 inline mr-1" /> : null}
                    {p.label}
                  </button>
                );
              })}
            </div>
            {hackathons.length > 0 ? (
              <p className="mt-2 text-xs text-teal-deep/70">
                Passport synced {hackathons.filter(isInstawards).length} InstaWards and{' '}
                {hackathons.length - hackathons.filter(isInstawards).length} other hackathons. Mark
                the program here; name the event in the note.
              </p>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className={labelCls}>Country</legend>
            <div className="flex flex-wrap gap-2">
              {KNOWN_COUNTRIES.map((c) => {
                const on = countries.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(countries, setCountries, c)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      on
                        ? 'border-teal-ink bg-teal-ink text-sand'
                        : 'border-teal-ink/20 text-teal-deep hover:bg-teal-ink/5'
                    }`}
                  >
                    {on ? <Check className="w-3 h-3 inline mr-1" /> : null}
                    {c}
                  </button>
                );
              })}
            </div>
            {countries.some((c) => !(c in COUNTRY_PROGRAMS)) ? null : (
              <p className="mt-2 text-xs text-teal-deep/70">
                With no country, the repository does not show up in the regional filters.
              </p>
            )}
          </fieldset>

          <div>
            <label className={labelCls} htmlFor="add-category">
              Category
            </label>
            <select
              id="add-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectCls}
            >
              <option value="">No published</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {analysis.categoryHints.includes(c) ? ' · suggested' : ''}
                </option>
              ))}
            </select>
            {analysis.categoryHints.length > 0 ? (
              <p className="mt-1.5 text-xs text-teal-deep/70">
                Suggested by topics: {analysis.categoryHints.join(', ')}. Correct it if the topic
                lies.
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelCls} htmlFor="add-builder">
              Builder name
            </label>
            <input
              id="add-builder"
              type="text"
              value={builderName}
              onChange={(e) => setBuilderName(e.target.value)}
              placeholder={analysis.owner ? `${analysis.owner.login} (owner of the repo)` : 'Person name'}
              className={inputCls}
            />
            <p className="mt-1.5 text-xs text-teal-deep/70">
              {analysis.owner?.type === 'Organization'
                ? `${analysis.owner.login} is an organization, not a person. Leave empty if you do not know who writes the code.`
                : 'Empty means attribution stays with the repository owner.'}
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="add-note">
              Note
            </label>
            <textarea
              id="add-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Event name, evidence link, anything the source doesn't publish..."
              className={`${inputCls} resize-y`}
            />
          </div>

          <div className="rounded-xl border border-teal-ink/15 bg-white/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] uppercase tracking-widest text-teal-deep/70">
                Entry to add
              </h3>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-ink/20 text-xs font-medium px-3 py-1.5 text-teal-deep hover:bg-teal-ink/5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto text-[11px] leading-relaxed text-teal-ink font-mono">
              {payload}
            </pre>
            <p className="mt-3 text-xs text-teal-deep/70">
              This page does not write to the repository: Atlas is a static site and{' '}
              <code className="font-mono">data/</code> is the versioned canonical source. Paste this
              block into <code className="font-mono">web/data/curated-additions.json</code>, run{' '}
              <code className="font-mono">npm run data</code> y commiteá.
            </p>
            <a
              href={analysis.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-teal-deep underline underline-offset-2 hover:text-teal-ink"
            >
              {analysis.fullName} on GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
