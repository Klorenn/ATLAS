// Curaduría de un repositorio: lee GitHub en vivo y propone una ficha.
//
// Reparto de responsabilidades, y por qué está repartido así:
//
//   · GitHub API  → se consulta DESDE el navegador. Envía
//                   `access-control-allow-origin: *`, y sin clave da 60
//                   peticiones/hora, suficiente para uso manual.
//   · Passport    → NO se consulta desde el navegador. Verificado: ni el GET
//                   público ni el preflight OPTIONS devuelven cabeceras CORS,
//                   así que el navegador lo bloquearía. Además `pk_...` es un
//                   bearer de organización y en el bundle quedaría público.
//                   Se lee del snapshot que produce scripts/fetch-passport.mjs.
//
// Lo que la fuente no publica viaja como null y se muestra como "—". Un valor
// no verificado se propose, no se afirma: la persona que cura decide.

import { COUNTRY_PROGRAMS, CATEGORIES } from './catalog';

export interface PassportHackathon {
  slug: string | null;
  name: string | null;
  format: string | null;
  hackathonType: string | null;
  status: string | null;
  participantCount: number | null;
}

export interface PassportBuilder {
  githubUsername: string | null;
  displayName: string | null;
  location: string | null;
  stellarAddress: string | null;
  scfTier: string | null;
  visibility: Record<string, boolean> | null;
}

/**
 * Un proyecto se identifica por `builderLogin/slug`. El slug solo no alcanza:
 * en la sincronización del 2026-09-28 dos builders distintos tienen un proyecto
 * `arcusx`.
 */
export interface PassportProject {
  key: string;
  slug: string | null;
  name: string | null;
  builderLogin: string;
  shortDescription: string | null;
  status: string | null;
  tags: string[];
  websiteUrl: string | null;
  repos: string[];
}

export interface PassportRepo {
  fullName: string;
  url: string | null;
  language: string | null;
  stars: number | null;
  forks: number | null;
  description: string | null;
  /** Un repo puede colgar de más de un proyecto. */
  projects: { key: string; slug: string | null; builderLogin: string }[];
}

export interface PassportSnapshot {
  observedAt: string | null;
  counts: { hackathons: number; builders: number; projects: number; repos: number };
  hackathons: PassportHackathon[];
  builders: PassportBuilder[];
  projects: PassportProject[];
  repos: PassportRepo[];
}

export interface RepoAnalysis {
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  topics: string[];
  archived: boolean;
  pushedAt: string | null;
  homepage: string | null;
  license: string | null;
  owner: { login: string; type: 'User' | 'Organization' } | null;
  /** Topics que sugieren una categoría. No es una clasificación. */
  categoryHints: string[];
}

export interface CuratedRepository {
  id: string;
  fullName: string;
  url: string;
  projectSlugs: string[];
  projectNames: string[];
  language: string | null;
  stars: number | null;
  lastCommitAt: string | null;
  sourceType: string;
  sourceUrl: string | null;
  associationEvidence: string;
  associations: unknown[];
  role: null;
  observedAt: string;
  /**
   * Curaduría explícita. El runtime deriva programa, país y categoría de la
   * fuente; estos tres campos son la excepción, y existen para una entrada
   * que una persona agregó a mano y la fuente no conoce. Ausentes = null.
   */
  curatedPrograms?: string[];
  curatedCountries?: string[];
  curatedCategory?: string | null;
  note?: string;
}

export interface CuratedBuilderEntry {
  repo: string;
  builderName: string | null;
  builderLogin: string | null;
  builderUrl: string | null;
  organization: string | null;
  url: string;
  sourceUrl: string | null;
  observedAt: string;
  note: string;
}

/** Slugs de programa que esta herramienta puede asignar a mano. */
export const ASSIGNABLE_PROGRAMS = [
  { value: 'instawards', label: 'InstaWards' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'scf', label: 'Stellar Community Fund' },
  { value: 'community', label: 'Community' },
] as const;

/**
 * Países con programa propio en Atlas. El snapshot de hackathons trae el
 * país de cada evento, así que la lista real se deriva de los datos; esta
 * semilla cubre los que el modelo ya reconoce.
 */
export const KNOWN_COUNTRIES = Object.keys(COUNTRY_PROGRAMS);

const TOPIC_CATEGORY: Record<string, string> = {
  stellar: 'Infrastructure',
  soroban: 'Developer Tools',
  'smart-contracts': 'Developer Tools',
  contracts: 'Developer Tools',
  sdk: 'Developer Tools',
  'stellar-sdk': 'Developer Tools',
  anchor: 'Infrastructure',
  rpc: 'Infrastructure',
  indexer: 'Developer Tools',
  explorer: 'Developer Tools',
  dex: 'DeFi',
  amm: 'DeFi',
  defi: 'DeFi',
  lending: 'DeFi',
  vault: 'DeFi',
  yield: 'DeFi',
  swap: 'DeFi',
  payments: 'Payments',
  payment: 'Payments',
  stablecoin: 'Payments',
  fiat: 'Payments',
  remittance: 'Payments',
  wallet: 'Wallets',
  'wallet-sdk': 'Wallets',
  passkey: 'Wallets',
  'account-abstraction': 'Wallets',
  nft: 'NFT',
  gaming: 'Gaming',
  game: 'Gaming',
  ai: 'AI',
  llm: 'AI',
  agents: 'AI',
  'machine-learning': 'AI',
  identity: 'Identity',
  kyc: 'Identity',
  'proof-of-personhood': 'Identity',
  zk: 'Identity',
  privacy: 'Identity',
  education: 'Education',
  learning: 'Education',
  tutorial: 'Education',
  social: 'Social',
  community: 'Social',
  hackathon: 'Hackathon',
  ideathon: 'Ideathon',
  instawards: 'Hackathon',
};

/**
 * Acepta lo que una persona pega de verdad: URL completa, `owner/repo`, o
 * texto con la URL incrustada. Devuelve null si no se puede leer, para que la
 * interfaz pueda pedir la URL en vez de adivinar.
 */
export function parseRepoInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const fromUrl = raw.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
  const candidate = fromUrl ? `${fromUrl[1]}/${fromUrl[2]}` : raw.replace(/^\/+|\/+$/g, '');
  const m = candidate.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;

  // `.git` y rutas más profundas no son un repositorio.
  const name = m[2].replace(/\.git$/i, '');
  if (!name) return null;
  return `${m[1]}/${name}`;
}

/**
 * Lee el repositorio y su dueño. La API de GitHub no requiere clave para
 * lectura; el límite son 60 req/h sin autenticar, y un fallo 403 por rate
 * limit se distingue de un 404 para no报告显示 "no existe" cuando el
 * problema es otro.
 */
export async function analyzeRepo(
  fullName: string,
  signal?: AbortSignal,
): Promise<RepoAnalysis> {
  const headers = { Accept: 'application/vnd.github+json' };

  const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers, signal });
  if (res.status === 404) throw new Error('No public repository at that path.');
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      throw new Error('GitHub rate limit reached: 60 requests per hour unauthenticated. Try again later.');
    }
    throw new Error(`GitHub replied 403: ${res.statusText}`);
  }
  if (!res.ok) throw new Error(`GitHub replied ${res.status}: ${res.statusText}`);

  const d = await res.json();
  const topics: string[] = Array.isArray(d.topics) ? d.topics : [];
  const owner =
    d.owner && typeof d.owner.login === 'string'
      ? { login: d.owner.login, type: d.owner.type === 'Organization' ? ('Organization' as const) : ('User' as const) }
      : null;

  const hints = [...new Set(topics.map((t) => TOPIC_CATEGORY[t.toLowerCase()]).filter(Boolean))] as string[];

  return {
    fullName: d.full_name ?? fullName,
    url: d.html_url ?? `https://github.com/${fullName}`,
    description: d.description ?? null,
    language: d.language ?? null,
    stars: typeof d.stargazers_count === 'number' ? d.stargazers_count : null,
    topics,
    archived: d.archived === true,
    pushedAt: d.pushed_at ?? null,
    homepage: d.homepage || null,
    license: d.license?.spdx_id ?? null,
    owner,
    categoryHints: hints.filter((c) => CATEGORIES.includes(c)),
  };
}

/**
 * Cruza el repositorio con el snapshot de Passport: si el dueño tiene perfil
 * de builder, y qué hackathons existen para proponer uno.
 *
 * La visibilidad manda. Passport expone `visibility` porque el builder elige
 * qué se muestra; un campo presente en el payload no autoriza a publicarlo.
 */
export function crossCheckPassport(
  analysis: RepoAnalysis,
  passport: PassportSnapshot | null,
): { builder: PassportBuilder | null; visibility: Record<string, boolean> | null } {
  if (!passport || !analysis.owner) return { builder: null, visibility: null };
  const login = analysis.owner.login.toLowerCase();
  const builder = passport.builders.find((b) => (b.githubUsername || '').toLowerCase() === login) || null;
  return { builder, visibility: builder?.visibility ?? null };
}

/**
 * El mismo repositorio, buscado por nombre en el registro de Passport.
 *
 * Esta búsqueda es mejor que cruzar por el owner de GitHub para atribuir, y no
 * por una preferencia: no coinciden. El 2026-09-28, `SendaLabs/Senda.App`
 * figura en Passport bajo el builder `delfinacorr`, y `StellarViewOrg/
 * stellarview-explorer` bajo dos proyectos de builders distintos. El owner de
 * GitHub es una organización o la cuenta de deploy; el builder es quien se
 * declara responsable del proyecto.
 */
export function passportRepoFor(
  analysis: RepoAnalysis,
  passport: PassportSnapshot | null,
): PassportRepo | null {
  if (!passport) return null;
  const id = analysis.fullName.toLowerCase();
  return passport.repos.find((r) => r.fullName.toLowerCase() === id) || null;
}

/** Los proyectos que Passport le atribuye a un builder, por login de GitHub. */
export function passportProjectsFor(
  login: string | null,
  passport: PassportSnapshot | null,
): PassportProject[] {
  if (!passport || !login) return [];
  const id = login.toLowerCase();
  return passport.projects.filter((p) => p.builderLogin.toLowerCase() === id);
}

/** InstaWards es un `format` de hackathon en Passport, no un programa aparte. */
export function passportHackathons(passport: PassportSnapshot | null): PassportHackathon[] {
  return passport?.hackathons ?? [];
}

export function isInstawards(h: PassportHackathon): boolean {
  return (h.format || '').toLowerCase() === 'instawards' || (h.hackathonType || '').toLowerCase() === 'instawards';
}

/**
 * Ensambla las entradas con la forma que consume
 * scripts/extract-catalog.mjs.
 *
 * Se devuelve un repositorio y, aparte, un builder opcional. No se anida el
 * builder dentro del repositorio: `curated-additions.json` ya tiene un array
 * `builders[]` que el script indexa por repo y al que da prioridad sobre el
 * owner. Reutilizarlo evita un segundo camino para la misma atribución.
 *
 * `curatedPrograms` usa los mismos slugs que el runtime ya filtra, para que
 * una entrada agregada a mano se comporte igual que una derivada de la fuente.
 * Sin builder curado, el owner del repo sigue siendo la atribución por
 * defecto: el script no necesita que se declare para tener algo que mostrar.
 */
export function buildEntry(opts: {
  analysis: RepoAnalysis;
  builderName: string | null;
  builderLogin: string | null;
  builderUrl: string | null;
  organization: string | null;
  programs: string[];
  countries: string[];
  category: string | null;
  note: string;
  observedAt: string;
  /**
   * De dónde salió la atribución. La nota por defecto depende de esto: un
   * builder declarado en Passport es evidencia propia, mientras que el owner
   * de GitHub suele ser la organización y no la persona que escribe el código.
   */
  builderEvidence?: 'passport' | 'owner' | null;
}): { repository: CuratedRepository; builder: CuratedBuilderEntry | null } {
  const { analysis } = opts;
  const fullName = analysis.fullName;
  const programs = [...new Set(opts.programs)].filter(Boolean).sort();
  const countries = [...new Set(opts.countries)].filter(Boolean).sort();

  const repository: CuratedRepository = {
    id: `github:${fullName.toLowerCase()}`,
    fullName,
    url: analysis.url,
    projectSlugs: [],
    projectNames: [],
    language: analysis.language,
    stars: analysis.stars,
    lastCommitAt: analysis.pushedAt ? analysis.pushedAt.slice(0, 10) : null,
    sourceType: 'curated-manual',
    sourceUrl: analysis.url,
    associationEvidence: 'curado',
    associations: [],
    role: null,
    observedAt: opts.observedAt,
    note: opts.note.trim() || 'Entry added by hand from /add.',
    // Solo si hay valor. Un array vacío se lee como "se revisó y no aplica",
    // que es un juicio que esta página no puede hacer: un campo sin marcar es
    // desconocido, no un veredicto.
    ...(programs.length > 0 ? { curatedPrograms: programs } : {}),
    ...(countries.length > 0 ? { curatedCountries: countries } : {}),
    ...(opts.category ? { curatedCategory: opts.category } : {}),
  };

  // Solo con nombre propio. Una atribución sin nombre no es una curaduría:
  // el runtime da prioridad a `curatedBuilder` sobre el owner del repo, así
  // que emitirla con `builderName: null` declararía un criterio que nadie
  // aplicó y taparía la atribución honesta por defecto.
  const builderName = opts.builderName?.trim() || null;
  const builder: CuratedBuilderEntry | null = builderName
    ? {
        repo: fullName,
        builderName,
        builderLogin: opts.builderLogin,
        builderUrl: opts.builderUrl,
        organization: opts.organization,
        url: analysis.url,
        sourceUrl: analysis.url,
        observedAt: opts.observedAt,
        note:
          opts.note.trim() ||
          (opts.builderEvidence === 'passport'
            ? 'Builder declaration imported from Stellar Passport.'
            : 'Attribution curated by hand from /add. The repository owner is an organization, not a person.'),
      }
    : null;

  return { repository, builder };
}
