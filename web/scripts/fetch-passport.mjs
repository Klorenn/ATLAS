#!/usr/bin/env node

// Sincroniza Stellar Passport a un snapshot local para consumo en runtime.
//
// Por qué no desde el navegador: la API de Passport no envía cabeceras CORS
// (ni en GET ni en el preflight OPTIONS), así que un fetch desde atlastelluscoop
// vercel.app lo bloquea. Y la clave `pk_...` es un bearer de organización: en el
// bundle de Vercel quedaría pública para cualquiera que abra DevTools. Ambas
// razones apuntan al mismo sitio: esta sincronización corre en Node, en local o
// en CI, y su salida es un archivo versionado.
//
//   PASSPORT_API_KEY=pk_... npm run passport
//
// Idempotente: se puede reejecutar sin cambios en el resto del pipeline.
//
// La clave viaja por variable de entorno, nunca por archivo ni por argumento.
// Si falta, el script falla con un mensaje accionable en vez de escribir un
// snapshot vacío que parecería un borrado de datos.

import { writeFile } from 'node:fs/promises';

// Lee ../../.env (raíz del repo) si existe, para no obligar a exportar la
// variable a mano. Un archivo ausente es normal en CI, donde la clave llega
// por entorno.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // sin .env: se sigue con process.env
}

const API = 'https://demo.stellarpassport.xyz/api/v1';
const OUT = new URL('../public/data/passport.json', import.meta.url);
const MAX_LIMIT = 100;
// Cuántos builders se detallan. Cada detalle es una request: 216 perfiles
// seguidos no es un presupuesto razonable para un script que corre a mano.
const MAX_DETAIL = 100;

const key = process.env.PASSPORT_API_KEY || '';
if (!key) {
  console.error(
    'Falta PASSPORT_API_KEY.\n' +
      '  export PASSPORT_API_KEY=pk_...   # Admin → API Keys en stellarpassport.xyz\n' +
      'No se escribe el snapshot: un archivo vacío se leería como un borrado.',
  );
  process.exit(1);
}

const observedAt = process.env.OBSERVED_AT || new Date().toISOString().slice(0, 10);

/**
 * Pagina por cursor hasta agotar la colección. `next_cursor` es opaco: se
 * devuelve sin modificar. Un cursor repetido cortaría el bucle con la lista a
 * medias, así que se detecta y se lanza en vez de seguir.
 *
 * `field` es el nombre de la colección dentro del envelope. No se llama `key`
 * a propósito: ese nombre pertenece a la clave de la API, y reutilizarlo la
 * tapa en silencio, mandando `Bearer builders` en el header.
 */
async function collect(path, field) {
  const out = [];
  let cursor = null;
  const seenCursors = new Set();

  for (let page = 0; page < 200; page++) {
    const url = new URL(`${API}${path}`);
    url.searchParams.set('limit', String(MAX_LIMIT));
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${path} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    out.push(...(json[field] || []));

    if (!json.has_more || !json.next_cursor) break;
    if (seenCursors.has(json.next_cursor)) {
      throw new Error(`${path}: el servidor repitió el cursor ${json.next_cursor}; pagination detenida`);
    }
    seenCursors.add(json.next_cursor);
    cursor = json.next_cursor;
  }
  return out;
}

/**
 * Normaliza a las mismas claves que consume el runtime. Se conservan solo los
 * campos que Atlas muestra; el resto del payload es ruido para la interfaz.
 *
 * `location` es texto libre y a veces es una ciudad, no un país ("Santiago").
 * Se guarda tal cual: el mapeo a país lo hace la persona que cura, no una
 * heurística que podría afirmar un país que la fuente no publica.
 */
const toHackathon = (h) => ({
  slug: h.slug ?? null,
  name: h.name ?? null,
  format: h.format ?? null,
  hackathonType: h.hackathon_type ?? null,
  status: h.status ?? null,
  prizePool: h.prize_pool ?? null,
  participantCount: h.participant_count ?? null,
  startDate: h.start_date ?? null,
  endDate: h.end_date ?? null,
});

const toBuilder = (b) => ({
  githubUsername: b.github_username ?? null,
  displayName: b.display_name ?? null,
  location: b.location ?? null,
  stellarAddress: b.stellar_address ?? null,
  websiteUrl: b.website_url ?? null,
  bio: b.bio ?? null,
  roleTitle: b.role_title ?? null,
  scfTier: b.scf_tier ?? null,
  // La visibilidad la elige el builder. Se conserva para que la interfaz pueda
  // respetarla, pero un campo presente en el payload no autoriza a mostrarlo.
  visibility: b.visibility ?? null,
});

/**
 * Un proyecto se identifica por `builderLogin/slug`, no por el slug solo: en la
 * sincronización del 2026-09-28 dos builders distintos tienen un proyecto
 * `arcusx`, así que el slug no es una clave global.
 */
const toProject = (p, builderLogin) => ({
  key: `${builderLogin}/${p.slug}`,
  slug: p.slug ?? null,
  name: p.name ?? null,
  builderLogin,
  shortDescription: p.short_description ?? null,
  status: p.status ?? null,
  tags: p.tags ?? [],
  websiteUrl: p.website_url ?? null,
  demoUrl: p.demo_url ?? null,
  docsUrl: p.docs_url ?? null,
  scfUrl: p.scf_url ?? null,
  contractAddress: p.contract_address ?? null,
  repos: (p.repos || []).map((r) => r.full_name).filter(Boolean),
});

const toRepo = (r) => ({
  fullName: r.full_name ?? null,
  url: r.html_url ?? null,
  language: r.primary_language ?? null,
  stars: typeof r.stars === 'number' ? r.stars : null,
  forks: typeof r.forks === 'number' ? r.forks : null,
  description: r.description ?? null,
});

const [hackathons, builders, bounties] = await Promise.all([
  collect('/hackathons', 'hackathons'),
  collect('/profiles', 'builders'),
  collect('/bounties', 'bounties').catch(() => []),
]);

// El detalle de un builder trae lo que la lista omite (`scf_tier`,
// `visibility`). Los proyectos y sus repositorios ya vienen en la lista, así que
// detallar no es necesario para conseguirlos: el detalle solo compra esos dos
// campos, y pagarlo para todos sería una request por builder a cambio de poco.
//
// `builders` son filas crudas, en snake_case: hay que normalizar antes de leer
// `githubUsername`, o el filtro no encuentra a nadie y el detalle nunca corre.
const listed = builders.map(toBuilder);
const detailed = [];
for (const b of listed.slice(0, MAX_DETAIL)) {
  if (!b.githubUsername) continue;
  const res = await fetch(`${API}/profiles/${encodeURIComponent(b.githubUsername)}`, {
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => null);
  if (!res || !res.ok) continue;
  const json = await res.json();
  if (json.builder) detailed.push(toBuilder(json.builder));
}

const byUsername = new Map(
  detailed.filter((b) => b.githubUsername).map((b) => [b.githubUsername.toLowerCase(), b]),
);
const merged = listed.map((b) => byUsername.get(String(b.githubUsername || '').toLowerCase()) || b);

// Proyectos y repositorios salen a nivel superior en vez de quedar anidados
// dentro de cada builder. Anidado, la interfaz tiene que recorrer el árbol para
// responder "¿qué proyectos tiene este builder?" o "¿qué repo es este?"; plano,
// son dos índices con una clave cada uno.
const projectIndex = new Map();
const repoIndex = new Map();

for (const row of builders) {
  const login = row.github_username ?? null;
  if (!login) continue;
  for (const p of row.projects || []) {
    if (!p.slug) continue;
    const project = toProject(p, login);
    // Dos filas del mismo builder pueden repetir el proyecto: se fusionan en
    // vez de duplicar la entrada.
    const prev = projectIndex.get(project.key);
    if (prev) {
      prev.repos = [...new Set([...prev.repos, ...project.repos])].sort();
      continue;
    }
    projectIndex.set(project.key, project);

    for (const r of p.repos || []) {
      const fullName = r.full_name ?? null;
      if (!fullName) continue;
      const id = fullName.toLowerCase();
      // Un repo puede pertenecer a más de un proyecto, así que la relación se
      // guarda como lista de referencias y no como un único propietario.
      const entry = repoIndex.get(id) || { ...toRepo(r), projects: [] };
      entry.projects.push({ key: project.key, slug: project.slug, builderLogin: login });
      repoIndex.set(id, entry);
    }
  }
}

const projects = [...projectIndex.values()].sort((a, b) => a.key.localeCompare(b.key));

const repos = [...repoIndex.values()]
  .map((r) => ({ ...r, projects: r.projects.sort((a, b) => a.key.localeCompare(b.key)) }))
  .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));

const snapshot = {
  observedAt,
  source: 'stellar-passport',
  sourceUrl: 'https://stellarpassport.xyz/docs/api-endpoints',
  counts: {
    hackathons: hackathons.length,
    builders: merged.length,
    projects: projects.length,
    repos: repos.length,
    bounties: bounties.length,
  },
  hackathons: hackathons.map(toHackathon),
  builders: merged,
  projects,
  repos,
};

await writeFile(OUT, `${JSON.stringify(snapshot)}\n`);

console.log(`Hackathons: ${hackathons.length}`);
console.log(`Builders: ${merged.length}`);
console.log(`Projects: ${projects.length}`);
console.log(`Repos: ${repos.length}`);
console.log(`Bounties: ${bounties.length}`);
console.log(`Salida: public/data/passport.json (observedAt ${observedAt})`);
