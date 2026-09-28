<img src="assets/readme/atlas-banner.png" alt="ATLAS, an open observatory for the Stellar ecosystem, by Tellus Cooperative" width="100%">

An open observatory for discovering projects and repositories across the Stellar ecosystem.

[![status: live](https://img.shields.io/badge/status-live-3F8487?style=flat-square&labelColor=1F3536)](https://atlastelluscoop.vercel.app/)
[![catalog: 6,864 repositories](https://img.shields.io/badge/catalog-6%2C864%20repositories-3F8487?style=flat-square&labelColor=1F3536)](web/public/data/catalog.json)
[![license: MIT](https://img.shields.io/badge/license-MIT-1F3536?style=flat-square&labelColor=1F3536)](LICENSE)
[![built by Tellus Cooperative](https://img.shields.io/badge/built%20by-Tellus%20Cooperative-ECE0CC?style=flat-square&labelColor=1F3536)](https://telluscoop.org)

**[Open ATLAS →](https://atlastelluscoop.vercel.app/)**

[Overview](#overview) · [Explore the ecosystem](#explore-the-ecosystem) · [How it works](#how-it-works) · [Tech stack](#tech-stack) · [Getting started](#getting-started) · [Project structure](#project-structure) · [Development](#development) · [Contributing](#contributing) · [License](#license) · [Credits](#credits)

## Overview

ATLAS turns a public directory of Stellar projects into a catalog you can actually browse. Instead of a flat list of links, every repository arrives with the project it belongs to, the programs that funded or hosted it, the language it is written in, and the person or organization behind it.

It is built for developers looking for prior art before starting something new, for builders trying to find collaborators or adjacent work, and for researchers and anyone mapping what the Stellar ecosystem has actually produced.

The catalog is a static JSON snapshot loaded at runtime. ATLAS does not call the GitHub API from the browser and does not track visitors. What the source does not publish is left empty rather than estimated: a missing star count stays `null`, never `0`.

## Explore the ecosystem

<img src="assets/readme/atlas-explore.png" alt="Illustration of an open notebook and a magnifying glass over catalog entries" width="100%">

| Capability | Description |
| --- | --- |
| Full-text search | Matches repository name, description, project, organization, builder, language, category and country in a single query. |
| Filters | Funding program, category, primary language and status. |
| Sorting | Last commit, stars, or alphabetical. |
| List and grid views | Two densities for the same result set. |
| Pagination | 24, 48 or 96 entries per page. |
| Shareable state | Search, filters, sorting, view and page are written to the URL query string. |
| Repository detail | A dialog with the project, funding, hackathon builds and related repositories; deep-linkable via `?repo=<slug>`. |

Everything above operates on the snapshot in `web/public/data/catalog.json`. There are no accounts, favorites or background sync.

## How it works

ATLAS is split into two halves that meet at a JSON file.

The build side is a set of Node scripts that read the raw source data, normalize it, and write a compact snapshot. The runtime side is a React single-page app that fetches that snapshot once and does all filtering, sorting and pagination in memory.

```mermaid
flowchart LR
  A[Source data<br/>NDJSON / JSON] --> B[scripts/extract-catalog.mjs]
  B --> C[public/data/catalog.json]
  C --> D[src/lib/catalog.ts<br/>filter · sort · paginate]
  D --> E[Explorer UI]
  F[URL query string] <--> D
```

`src/lib/catalog.ts` is the only place the raw shape is interpreted: it maps source records to the `Repository` model, derives categories and programs, and resolves the builder attribution. The UI components never touch raw fields.

## Tech stack

| Technology | Role |
| --- | --- |
| React 18 | UI layer |
| TypeScript 5.6 | Types and build-time checking |
| Vite 5 | Dev server and production bundler |
| Tailwind CSS 3.4 | Styling, with the Tellus Cooperative palette in `tailwind.config.js` |
| lucide-react | Icons |
| motion | Animation |
| @paper-design/shaders-react | Dithering backdrop |
| Node.js | Data extraction scripts (ESM) |

## Getting started

### Prerequisites

- Node.js `^18.0.0 || >=20.0.0` (required by Vite 5)
- npm (the repository ships a `package-lock.json`)

### Clone

```bash
git clone https://github.com/Klorenn/ATLAS.git
cd ATLAS/web
```

### Install

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

The app is served at `http://localhost:3002`. No configuration or environment variables are needed: the catalog is read from `public/data/catalog.json`, which is committed.

### Build and preview production

```bash
npm run build
npm run preview
```

`build` runs `tsc --noEmit` before `vite build`, so a type error fails the build. Output goes to `web/dist/`, with `base: './'`, so the bundle can be served from any subpath.

### Regenerate the catalog

```bash
npm run data
```

> `scripts/extract-catalog.mjs` reads the raw dataset from a `data/` directory three levels above `web/`. That dataset lives in the Tellus Cooperative roadmap workspace and is not part of this repository, so running `npm run data` outside that workspace will fail. Day-to-day development does not need it: the generated snapshot is already committed.

### Sync the Passport snapshot

```bash
npm run passport
```

`scripts/fetch-passport.mjs` reads Stellar Passport (hackathons, builder profiles, projects, and the repositories each project files) and writes `web/public/data/passport.json`, which the `/add` page uses to match a repository against known builders and projects. The committed snapshot is enough for development; re-run only to refresh it.

Projects and repositories live at the top level of the snapshot, not nested inside builders. A project is keyed by `builderLogin/slug` because the slug alone is not unique across builders, and a repository is keyed by `full_name` because one repository can belong to more than one project. `/add` resolves a repository by name, which attributes better than the GitHub owner: the owner is frequently the organization, while the declared builder is the person responsible for the project.

To promote the declared repositories into the catalog, run the classic merge from the roadmap root after refreshing the snapshot:

```bash
node scripts/merge-passport-repos.mjs   # appends missing repos + builders to the canonical collections
node scripts/validate-data.mjs
node scripts/build-app-catalog.mjs
cd tellus-atlas/web && npm run data
```

The merge is idempotent and only adds repositories Passport declares that no other source already brought in (40 of 89 on the 2026-09-28 snapshot). New records carry `source.type: "stellar-passport"`, `associationEvidence: "curado"`, stay linked to the Passport project slug, and leave `lastCommitAt` as `null` — Passport does not publish update dates.

It needs a Passport API key in a `.env` at the repository root:

```bash
PASSPORT_API_KEY=pk_...
```

Two constraints shape where this runs. Passport sends no CORS headers, on the GET or on the OPTIONS preflight, so the browser cannot call it. And `pk_...` is an organization bearer: in a Vite bundle it would be readable by anyone opening DevTools. So the sync runs in Node and publishes a file. GitHub is the opposite case: it allows CORS, so `/add` queries it directly from the browser and needs no key.

The current base URL is `https://demo.stellarpassport.xyz/api/v1`, a demo instance. Check what it holds before treating its contents as the real Passport population.

### Add a repository

`/add` reads a GitHub path, proposes a category from the repository topics, and assembles a `curated-additions.json` entry with the programs, country, and builder you select. When Passport has the repository on record, it shows the declared project(s) and builder, and "Use this builder" attributes the entry to that person instead of the GitHub owner. Values the source does not publish stay `null` and render as "—"; a category suggestion is a suggestion, not a classification.

The page does not write to the repository. To publish an entry:

1. Paste the generated block into `web/data/curated-additions.json`, under `repositories` and, if you named a builder, `builders`.
2. Run `npm run data` to regenerate `web/public/data/catalog.json`.
3. Commit both files.

`curatedPrograms`, `curatedCountries`, and `curatedCategory` add to what the source already says. They do not replace it: a repository curated as `instawards` keeps its hackathon badge, and a country from a hackathon build stays.

## Project structure

```text
.
├── assets/readme/        Images used by this README
├── web/                  The ATLAS application
│   ├── public/
│   │   ├── data/         Catalog snapshot (catalog.json, stats.json, passport.json)
│   │   └── logos/        Ecosystem logos used in the landing page
│   ├── scripts/          Node scripts that generate the snapshots
│   └── src/
│       ├── components/   Landing sections, the Explorer, and AddRepository
│       ├── lib/          catalog.ts (data model, filters, sorting, URL state)
│       │                 curate.ts (GitHub analysis, entry assembly)
│       └── data.ts       Static copy for the landing page
├── index.html            Standalone page mounting the vanilla explorer
├── explorer.js
├── explorer.css          Vanilla explorer component (no build step)
└── atlas.css
```

The files at the root are an earlier vanilla-JS explorer that runs without a bundler, useful for embedding the catalog in a plain HTML page. The React app under `web/` is the primary experience.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 3002 |
| `npm run build` | Type check (`tsc --noEmit`) then production bundle |
| `npm run preview` | Serve the built bundle on port 3002 |
| `npm run data` | Regenerate `public/data/catalog.json` (needs the external dataset) |

There is no linter, formatter or test suite configured in this repository yet. `npm run build` is the only automated check: keep it green before opening a pull request.

## Contributing

Bug reports, ideas and code are welcome. Open an issue using the bug report or feature request template, or send a pull request.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## License

Released under the [MIT License](LICENSE).

## Credits

<img src="assets/readme/atlas-logo.png" alt="ATLAS logo: a pixel-art ringed planet" width="160">

**Project:** Tellus Cooperative
**Creator:** [Klorenn](https://github.com/Klorenn)

ATLAS is an independent community project. It is not affiliated with, or endorsed by, the Stellar Development Foundation.

<img src="assets/readme/atlas-credits.png" alt="ATLAS, a project by Tellus Cooperative, created by Klorenn" width="100%">
