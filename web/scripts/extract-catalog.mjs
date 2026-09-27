#!/usr/bin/env node

// Extrae el catálogo canónico a public/data/catalog.json en forma compacta
// para consumo en runtime (fetch + skeleton). No inventa datos: null es null.
//
// Asociación de builds de hackathon, en orden de confianza:
//   1. repo   — el build declara ese githubUrl. Evidencia directa.
//   2. proyecto — el build declara ese projectSlug, salvo que el repositorio
//      pertenezca al proyecto paraguas de SDF. Sin esta exclusión, los
//      repos oficiales de stellar/* heredaban el país del hackathon.
// Un build nunca hereda país por associationEvidence ni por nombre similar.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const DATA = new URL('../../../data/', import.meta.url);

/** Proyecto paraguas: sus builds no describen a los repos de `stellar/*`. */
const UMBRELLA_PROJECT_SLUGS = new Set(['stellar-development-foundation']);

const normRepoKey = (githubUrl) => {
  try {
    const u = new URL(githubUrl);
    if (u.hostname.toLowerCase() !== 'github.com') return null;
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg.length < 2) return null;
    return `${seg[0]}/${seg[1]}`.toLowerCase();
  } catch {
    return null;
  }
};

const readNdjson = async (name) => {
  const text = await readFile(new URL(name, DATA), 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
};

const readJson = async (name) => JSON.parse(await readFile(new URL(name, DATA), 'utf8'));

const raw = await readFile(new URL('catalog.js', DATA), 'utf8');
const catalog = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

// ATLAS no puede describirse a sí mismo desde `data/`: ese pipeline es externo
// y regenera catalog.js por completo. Las entradas propias viven en el repo y
// se reinyectan en cada corrida. Se descartan si la fuente ya las trae.
const extras = JSON.parse(
  await readFile(new URL('../data/curated-additions.json', import.meta.url), 'utf8'),
);

const knownRepos = new Set(
  (catalog.repositories || []).map((r) => normRepoKey(r.url)).filter(Boolean),
);
catalog.repositories = [
  ...(catalog.repositories || []),
  ...(extras.repositories || []).filter((r) => !knownRepos.has(normRepoKey(r.url))),
];

const knownProjects = new Set((catalog.projects || []).map((p) => p.slug));
catalog.projects = [
  ...(catalog.projects || []),
  ...(extras.projects || []).filter((p) => !knownProjects.has(p.slug)),
];

// El summary viene contado de la fuente, así que queda corto tras el merge.
if (catalog.summary) {
  catalog.summary = {
    ...catalog.summary,
    projects: catalog.projects.length,
    repositories: catalog.repositories.length,
  };
}

const [events, submissions, curatedBuilders] = await Promise.all([
  readNdjson('hackathon-events.ndjson'),
  readNdjson('hackathon-submissions.ndjson'),
  readJson('curated-builders.json'),
]);

// Builders confirmados sobre nombres que la fuente no publica. Tiene prioridad
// sobre el owner del repo: una organización no es la persona que escribe el
// código. `url` null significa que no hay perfil verificado, no que se omita.
const builderByRepo = new Map(
  [...curatedBuilders, ...(extras.builders || [])].map((b) => [
    String(b.repo || '').toLowerCase(),
    b,
  ]),
);

const eventBySlug = new Map(events.map((e) => [e.slug, e]));

const toBuild = (s) => {
  const event = eventBySlug.get(s.hackathonSlug) || null;
  return {
    name: s.name ?? null,
    event: s.hackathon ?? null,
    eventSlug: s.hackathonSlug ?? null,
    // El país lo publica el evento, no la submission. Si el evento no lo
    // publica, el país es null: no se deduce de la sede delinear.
    country: event?.country ?? null,
    award: s.award ?? s.placement ?? null,
    winner: s.isWinner === true,
    builder: s.builder?.login ?? null,
    builderUrl: s.builder?.url ?? null,
    url: s.sourceUrl ?? null,
    repoUrl: s.githubUrl ?? null,
  };
};

const buildsByRepo = new Map();
const buildsByProject = new Map();
for (const s of submissions) {
  const build = toBuild(s);
  const key = normRepoKey(s.githubUrl);
  if (key) {
    if (!buildsByRepo.has(key)) buildsByRepo.set(key, []);
    buildsByRepo.get(key).push(build);
  }
  if (s.projectSlug) {
    if (!buildsByProject.has(s.projectSlug)) buildsByProject.set(s.projectSlug, []);
    buildsByProject.get(s.projectSlug).push(build);
  }
}

/** Ganadores primero, luego por fecha de build; estable dentro de cada grupo. */
const byPrecedence = (a, b) => Number(b.winner) - Number(a.winner) || a.name.localeCompare(b.name || '');

const projects = (catalog.projects || []).map((p) => ({
  slug: p.slug,
  name: p.name,
  category: p.category ?? null,
  types: p.types ?? [],
  status: p.status ?? null,
  description: p.description ?? p.summaryEn ?? null,
  website: p.website ?? null,
  scfAwarded: p.scf?.awarded === true,
  scfTotal: p.scf?.totalAwardedUSD ?? null,
  scfRounds: p.scf?.rounds ?? [],
  updatedAt: p.updatedAt ?? null,
  observedAt: p.observedAt ?? null,
}));

const repositories = (catalog.repositories || []).map((r) => {
  const key = normRepoKey(r.url);
  const direct = key ? buildsByRepo.get(key) || [] : [];
  const inherited = (r.projectSlugs || [])
    .filter((slug) => !UMBRELLA_PROJECT_SLUGS.has(slug))
    .flatMap((slug) => buildsByProject.get(slug) || []);

  const seen = new Set();
  const builds = [...direct, ...inherited]
    .filter((b) => {
      const id = `${b.eventSlug || ''}|${b.repoUrl || ''}|${b.name || ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort(byPrecedence);

  return {
    fullName: r.fullName,
    url: r.url,
    projectSlugs: r.projectSlugs ?? [],
    projectNames: r.projectNames ?? [],
    language: r.language ?? null,
    stars: r.stars ?? null,
    lastCommitAt: r.lastCommitAt ?? null,
    sourceType: r.sourceType ?? null,
    evidence: r.associationEvidence ?? null,
    observedAt: r.observedAt ?? null,
    curatedBuilder: builderByRepo.get(key) ?? null,
    hackathon: builds.length > 0,
    builds: builds.slice(0, 8),
  };
});

const hackStats = {
  events: events.length,
  builds: submissions.length,
  winners: submissions.filter((s) => s.isWinner === true).length,
  reposWithBuilds: repositories.filter((r) => r.hackathon).length,
};

const payload = {
  generatedAt: catalog.generatedAt ?? null,
  summary: catalog.summary ?? null,
  hackStats,
  projects,
  repositories,
};

// `import.meta.url` apunta a scripts/, así que la salida sube un nivel a web/public.
const outPath = new URL('../public/data/catalog.json', import.meta.url);
await mkdir(new URL('.', outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(payload)}\n`);

const kb = ((await readFile(outPath)).length / 1024).toFixed(0);
console.log(`Proyectos: ${projects.length}`);
console.log(`Repositorios: ${repositories.length}`);
console.log(`Hackathons: ${hackStats.events} eventos · ${hackStats.builds} builds · ${hackStats.winners} ganadores`);
console.log(`Repos con build: ${hackStats.reposWithBuilds}`);
console.log(`Salida: public/data/catalog.json (${kb} KB)`);
