// Atlas data layer: loads the real catalog at runtime, maps it to the
// Repository model, and exposes filter / sort / paginate helpers.
// Null means the source does not publish the datum — never zero or false.

export type RepositoryStatus = 'active' | 'archived' | 'experimental';

export interface HackBuild {
  name: string;
  event: string;
  eventSlug: string;
  country: string | null;
  award: string | null;
  winner: boolean;
  builder: string | null;
  builderUrl: string | null;
  url: string | null;
  repoUrl: string | null;
}

export interface Builder {
  /** Nombre de la persona. Curado cuando la fuente no publica un login. */
  name: string | null;
  /** Login de GitHub. null si no hay perfil verificado. */
  login: string | null;
  /** null cuando no hay perfil público: la UI lo muestra como texto plano. */
  url: string | null;
  /** hackathon = persona detrás de un build; owner = owner del repo;
   *  curated = atribución confirmada fuera de la fuente. */
  basis: 'hackathon' | 'owner' | 'curated';
}

export interface Repository {
  id: string;
  slug: string;
  name: string;
  description: string;
  repositoryUrl: string;
  websiteUrl: string | null;
  organization: string | null;
  category: string[];
  primaryLanguage: string | null;
  status: RepositoryStatus;
  stars: number | null;
  updatedAt: string | null;
  observedAt: string | null;
  programs: string[];
  scfTotal: number | null;
  projectName: string | null;
  projectSlug: string | null;
  projectStatus: string | null;
  evidence: string | null;
  /** Motivo de una curaduría manual. null cuando la entrada viene de la fuente. */
  curatedNote: string | null;
  hackathon: boolean;
  builds: HackBuild[];
  builder: Builder | null;
  countries: string[];
}

export interface CatalogSummary {
  projects: number;
  repositories: number;
  fundedProjects: number;
  fundedUsd: number;
}

export interface Filters {
  q: string;
  category: string;
  program: string;
  language: string;
  status: string;
  sort: 'updated' | 'stars' | 'az';
  view: 'list' | 'grid';
  page: number;
  limit: number;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  category: 'all',
  program: 'all',
  language: 'all',
  status: 'all',
  sort: 'updated',
  view: 'list',
  page: 1,
  limit: 24,
};

const TYPE_TO_CATEGORY: Record<string, string> = {
  Wallet: 'Wallets',
  DEX: 'DeFi',
  Lending: 'DeFi',
  Bridge: 'Infrastructure',
  Infrastructure: 'Infrastructure',
  Payments: 'Payments',
  Anchor: 'Infrastructure',
  SDK: 'Developer Tools',
  Indexer: 'Developer Tools',
  Explorer: 'Developer Tools',
  Analytics: 'Developer Tools',
  AI: 'AI',
  Gaming: 'Gaming',
  Education: 'Education',
  Security: 'Developer Tools',
  NFT: 'NFT',
  RWA: 'DeFi',
  Stablecoin: 'Payments',
  'Social Impact': 'Social',
  RPC: 'Infrastructure',
  Faucet: 'Developer Tools',
  'Card Issuing': 'Payments',
  Exchange: 'DeFi',
  Oracle: 'Infrastructure',
  Yield: 'DeFi',
};

export const COUNTRY_PROGRAMS: Record<string, { slug: string; name: string }> = {
  Chile: { slug: 'chile', name: 'Chile' },
  Brazil: { slug: 'brazil', name: 'Brazil' },
  Argentina: { slug: 'argentina', name: 'Argentina' },
  Mexico: { slug: 'mexico', name: 'Mexico' },
  LATAM: { slug: 'latam', name: 'LATAM' },
};

export const PROGRAM_LABELS: Record<string, string> = {
  scf: 'SCF',
  hackathon: 'Hackathon',
  // Passport publica InstaWards como `format` de hackathon. Atlas lo expone
  // como programa propio para poder filtrarlo aparte.
  instawards: 'InstaWards',
  community: 'Community',
  chile: 'Chile',
  brazil: 'Brazil',
  argentina: 'Argentina',
  mexico: 'Mexico',
  latam: 'LATAM',
};

export const CATEGORIES = [
  'Payments',
  'DeFi',
  'Wallets',
  'Infrastructure',
  'Developer Tools',
  'Identity',
  'Gaming',
  'NFT',
  'AI',
  'Social',
  'Education',
  'Hackathon',
  'Ideathon',
  'Other',
];

interface RawProject {
  slug: string;
  name: string;
  category: string | null;
  types: string[];
  status: string | null;
  description: string | null;
  website: string | null;
  scfAwarded: boolean;
  scfTotal: number | null;
  scfRounds: number[];
  updatedAt: string | null;
  observedAt: string | null;
}

interface CuratedBuilder {
  repo: string;
  builderName: string | null;
  builderLogin: string | null;
  builderUrl: string | null;
  organization: string | null;
  note: string | null;
}

interface RawRepo {
  fullName: string;
  url: string;
  projectSlugs: string[];
  projectNames: string[];
  language: string | null;
  stars: number | null;
  lastCommitAt: string | null;
  sourceType: string | null;
  evidence: string | null;
  observedAt: string | null;
  curatedBuilder?: CuratedBuilder | null;
  // Curaduría explícita desde web/data/curated-additions.json.
  curatedPrograms?: string[] | null;
  curatedCountries?: string[] | null;
  curatedCategory?: string | null;
  curatedNote?: string | null;
  hackathon?: boolean;
  builds?: HackBuild[];
}

function slugifyRepo(fullName: string): string {
  return fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapStatus(projectStatus: string | null): RepositoryStatus {
  if (projectStatus === 'Inactive') return 'archived';
  if (projectStatus === 'Draft' || projectStatus === 'Development' || projectStatus === 'Pre-Release')
    return 'experimental';
  return 'active';
}

function categoriesFor(p: RawProject): string[] {
  const out: string[] = [];
  for (const t of p.types || []) {
    const c = TYPE_TO_CATEGORY[t];
    if (c && !out.includes(c)) out.push(c);
  }
  if (out.length === 0) {
    if (p.category === 'User-Facing App') out.push('Wallets');
    else if (p.category === 'Protocol/Contract') out.push('DeFi');
    else if (p.category === 'Infrastructure') out.push('Infrastructure');
    else if (p.category === 'Tooling') out.push('Developer Tools');
    else if (p.category === 'Anchor') out.push('Infrastructure');
    else if (p.category === 'Asset') out.push('Payments');
    else out.push('Other');
  }
  return out;
}

export async function loadCatalog(
  base: string,
): Promise<{ repos: Repository[]; summary: CatalogSummary; languages: string[] }> {
  const res = await fetch(`${base}data/catalog.json`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const json = await res.json();
  const projects: RawProject[] = json.projects || [];
  const rawRepos: RawRepo[] = json.repositories || [];
  const bySlug = new Map(projects.map((p) => [p.slug, p]));

  const repos: Repository[] = rawRepos.map((r, i) => {
    const primarySlug = r.projectSlugs[0] || null;
    const project = primarySlug ? bySlug.get(primarySlug) || null : null;
    const owner = r.fullName.split('/')[0] || null;
    const builds: HackBuild[] = r.builds ?? [];
    // La curaduría suma a lo derivado: son fuentes distintas, no
    // correcciones. Un repo sin build y curado como InstaWards queda con
    // ambos programas, y uno curado como Chile conserva su hackathon.
    const countries = [
      ...new Set([...builds.map((b) => b.country), ...(r.curatedCountries || [])].filter((c): c is string => !!c)),
    ];
    const programs: string[] = [];
    if (project && project.scfAwarded) programs.push('scf');
    if (r.hackathon) programs.push('hackathon');
    for (const c of countries) {
      const regional = COUNTRY_PROGRAMS[c];
      if (regional && !programs.includes(regional.slug)) programs.push(regional.slug);
    }
    for (const p of r.curatedPrograms || []) {
      if (!programs.includes(p)) programs.push(p);
    }
    let category = project ? categoriesFor(project) : ['Other'];
    if (category.length === 1 && category[0] === 'Other' && builds.length > 0) {
      const slug = (builds[0].eventSlug || '').toLowerCase();
      category = slug.includes('ideaton') || slug.includes('ideathon') ? ['Ideathon'] : ['Hackathon'];
    }
    if (r.curatedCategory) {
      // 'Other' es un fallback, no una clasificación: si es lo único que hay,
      // la curaduría lo reemplaza en vez de quedar al lado. Cuando ya hay
      // categorías reales, se suma.
      category =
        category.length === 1 && category[0] === 'Other'
          ? [r.curatedCategory]
          : category.includes(r.curatedCategory)
            ? category
            : [...category, r.curatedCategory];
    }
    const person = builds.find((b) => b.winner && b.builder) || builds.find((b) => b.builder);
    // La atribución curada gana: una organización no es quien escribe el
    // código, y el owner del repo tampoco cuando la persona ya se conoce.
    const curated = r.curatedBuilder ?? null;
    const builder: Builder | null = curated
      ? {
          name: curated.builderName,
          login: curated.builderLogin,
          url: curated.builderUrl,
          basis: 'curated',
        }
      : person?.builder
        ? {
            name: null,
            login: person.builder,
            url: person.builderUrl || `https://github.com/${person.builder}`,
            basis: 'hackathon',
          }
        : owner
          ? { name: null, login: owner, url: `https://github.com/${owner}`, basis: 'owner' }
          : null;
    return {
      id: `repo-${i}`,
      slug: slugifyRepo(r.fullName),
      name: r.fullName,
      description: project?.description || '',
      repositoryUrl: r.url,
      websiteUrl: project?.website || null,
      organization: owner,
      category,
      primaryLanguage: r.language,
      status: mapStatus(project?.status || null),
      stars: r.stars,
      // Sin lastCommitAt no se afirma actividad: null va al fondo,
      // nunca se suplanta con la fecha de extracción.
      updatedAt: r.lastCommitAt || null,
      observedAt: r.observedAt,
      programs,
      hackathon: r.hackathon === true,
      builds,
      builder,
      countries,
      scfTotal: project?.scfTotal || null,
      projectName: project?.name || r.projectNames[0] || null,
      projectSlug: primarySlug,
      projectStatus: project?.status || null,
      evidence: r.evidence,
      curatedNote: r.curatedNote ?? null,
    };
  });

  const langs = [...new Set(repos.map((r) => r.primaryLanguage).filter((l): l is string => !!l))].sort();
  const summary: CatalogSummary = {
    projects: json.summary?.projects || projects.length,
    repositories: json.summary?.repositories || repos.length,
    fundedProjects: json.summary?.fundedProjects || 0,
    fundedUsd: json.summary?.fundedUsd || 0,
  };
  return { repos, summary, languages: langs };
}

export function builderLabel(b: Builder | null): string | null {
  if (!b) return null;
  if (b.name) return b.name;
  return b.login ? `@${b.login}` : null;
}

export function filterRepositories(repos: Repository[], f: Filters): Repository[] {
  const q = f.q.trim().toLowerCase();
  return repos.filter((r) => {
    if (q) {
      const hay = [
        r.name,
        r.description,
        r.projectName,
        r.organization,
        r.builder?.login,
        // Un builder curado puede no tener login: sin esto "Joaquín" no
        // encuentra nada y el buscador parece roto.
        r.builder?.name,
        r.primaryLanguage,
        r.category.join(' '),
        r.countries.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.category !== 'all' && !r.category.includes(f.category)) return false;
    if (f.program !== 'all' && !r.programs.includes(f.program)) return false;
    if (f.language !== 'all' && (r.primaryLanguage || '').toLowerCase() !== f.language.toLowerCase())
      return false;
    if (f.status !== 'all' && r.status !== f.status) return false;
    return true;
  });
}

export function sortRepositories(repos: Repository[], sort: Filters['sort']): Repository[] {
  const arr = [...repos];
  if (sort === 'stars') arr.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  else if (sort === 'az') arr.sort((a, b) => a.name.localeCompare(b.name));
  else arr.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return arr;
}

export function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * limit;
  return { data: items.slice(start, start + limit), page: p, total, pages };
}

export function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) {
    const d = Math.floor(s / 86400);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  if (s < 86400 * 365) {
    const m = Math.floor(s / (86400 * 30));
    return `${m} month${m === 1 ? '' : 's'} ago`;
  }
  const y = Math.floor(s / (86400 * 365));
  return `${y} year${y === 1 ? '' : 's'} ago`;
}

export function readParams(): Filters {
  const p = new URLSearchParams(window.location.search);
  const limit = parseInt(p.get('limit') || '24', 10);
  return {
    q: p.get('q') || '',
    category: p.get('category') || 'all',
    program: p.get('program') || 'all',
    language: p.get('language') || 'all',
    status: p.get('status') || 'all',
    sort: (p.get('sort') as Filters['sort']) || 'updated',
    view: p.get('view') === 'grid' ? 'grid' : 'list',
    page: Math.max(1, parseInt(p.get('page') || '1', 10) || 1),
    limit: [24, 48, 96].includes(limit) ? limit : 24,
  };
}

export function writeParams(f: Filters) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category !== 'all') p.set('category', f.category);
  if (f.program !== 'all') p.set('program', f.program);
  if (f.language !== 'all') p.set('language', f.language);
  if (f.status !== 'all') p.set('status', f.status);
  if (f.sort !== 'updated') p.set('sort', f.sort);
  if (f.view !== 'list') p.set('view', f.view);
  if (f.page !== 1) p.set('page', String(f.page));
  if (f.limit !== 24) p.set('limit', String(f.limit));
  const url = `${window.location.pathname}${p.toString() ? `?${p.toString()}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}
