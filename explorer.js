// Stellar Atlas — explorador del catálogo, como componente montable.
//
// Se monta dentro de cualquier host y no depende de ids globales: los selectores
// se resuelven relativos al propio host, sin duplicar la lógica de filtrado
// ni el formato de las fichas.

(function initAtlasExplorer(global) {
  'use strict';

  const PAGE_SIZE = 48;
  const NOUN = { projects: 'proyecto', repositories: 'repositorio' };

  const STATUS_LABEL = {
    Live: 'En vivo',
    Development: 'En desarrollo',
    Draft: 'Borrador',
    Inactive: 'Inactivo',
    'Pre-Release': 'Prelanzamiento',
  };

  const SOURCE_LABEL = {
    directory: 'Directorio de Stellar Light (HTML público)',
    'scout-api': 'Scout API (catálogo curado)',
    'raven-directory': 'Importación Raven (artefacto privado)',
    'catalog-source': 'Código de la fuente del catálogo',
    curated: 'Capa curada manual',
  };

  const EVIDENCE_LABEL = {
    curado: 'La API de Scout declara el par proyecto-repositorio. Es evidencia fuerte de pertenencia.',
    mencionado: 'El enlace aparece en la ficha del proyecto sin que la API lo confirme. Es un enlace, no una pertenencia.',
  };

  const ROLE_LABEL = {
    'catalog-source': 'Es el código del directorio del que se extraen los datos. Es una dependencia de la fuente, no un producto del ecosistema.',
  };

  // Cada instancia mantiene su propio estado y sus propios nodos, de modo que dos
  // montajes en la misma página no se pisen.
  function createExplorer(catalog, root) {
    const el = (selector) => root.querySelector(selector);

    const search = el('[data-sa="search"]');
    const category = el('[data-sa="category"]');
    const status = el('[data-sa="status"]');
    const extra = el('[data-sa="extra"]');
    const clearBtn = el('[data-sa="clear"]');
    const grid = el('[data-sa="grid"]');
    const count = el('[data-sa="count"]');
    const empty = el('[data-sa="empty"]');
    const pager = el('[data-sa="pager"]');
    const prev = el('[data-sa="prev"]');
    const next = el('[data-sa="next"]');
    const pageInfo = el('[data-sa="page-info"]');
    const pageNums = el('[data-sa="page-nums"]');
    const dialog = el('[data-sa="dialog"]');
    const dialogTitle = el('[data-sa="dialog-title"]');
    const dialogBody = el('[data-sa="dialog-body"]');
    const closeBtn = el('[data-sa="dialog-close"]');
    const stats = el('[data-sa="stats"]');

    const state = { view: 'projects', page: 1, lang: 'es' };

    const initialLang = (() => {
      try {
        const param = new URLSearchParams(global.location?.search ?? '').get('lang');
        if (param === 'es' || param === 'en') return param;
        const stored = global.localStorage?.getItem('sa-lang');
        if (stored === 'es' || stored === 'en') return stored;
      } catch {
        // Sin almacenamiento o URL disponible: se mantiene el español.
      }
      return 'es';
    })();
    state.lang = initialLang;

    const summaryFor = (item) => {
      if (state.lang === 'en') {
        if (item.summaryEn) return { text: item.summaryEn, pending: false };
        if (item.summaryEs) return { text: item.summaryEs, pending: true, fallback: 'es' };
        if (item.description) return { text: item.description, pending: true, fallback: 'es' };
        return { text: null, pending: true };
      }
      if (item.summaryEs) return { text: item.summaryEs, pending: false };
      if (item.summaryEn) return { text: item.summaryEn, pending: true, fallback: 'en' };
      if (item.description) return { text: item.description, pending: true, fallback: 'en' };
      return { text: null, pending: true };
    };

    const websiteFor = (item) => {
      const value = item.website ?? item.url ?? null;
      if (!value) return { value: null, basis: null };
      const basis = item.websiteBasis ?? (item.url ? 'project-url' : null);
      return { value, basis };
    };

    const escapeHtml = (value) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    // Una URL que no sea http(s) no debe acabar en un href ni en un target=_blank.
    const safeUrl = (value) => {
      if (typeof value !== 'string' || value === '') return null;
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
      } catch {
        return null;
      }
    };

    const link = (value, label) => {
      const url = safeUrl(value);
      if (!url) return null;
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label ?? url)}</a>`;
    };

    const usd = (value) => (value === null || value === undefined
      ? null
      : new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      }).format(value));

    const unique = (values) => [...new Set(values.filter(Boolean))].sort();

    // ---------------------------------------------------------------- resumen

    if (stats) {
      const summary = catalog.summary ?? {};
      stats.innerHTML = [
        { label: 'proyectos', value: summary.projects },
        { label: 'repositorios', value: summary.repositories },
        { label: 'con SCF', value: summary.fundedProjects },
        { label: 'SCF declarado', value: usd(summary.fundedUsd) },
        { label: 'asociaciones curadas', value: summary.curatedRepositories },
      ].filter((entry) => entry.value !== undefined && entry.value !== null)
        .map((entry) => `<div><dt>${escapeHtml(entry.value)}</dt><dd>${escapeHtml(entry.label)}</dd></div>`)
        .join('');
    }

    // ---------------------------------------------------------------- filtros

    const currentEntities = () => (state.view === 'projects' ? catalog.projects : catalog.repositories);

    const FACETS = {
      projects: () => ({
        category: { options: unique(catalog.projects.map((item) => item.category)), label: 'Todas las categorías' },
        status: {
          options: unique(catalog.projects.map((item) => item.status))
            .map((value) => ({ value, label: STATUS_LABEL[value] ?? value })),
          label: 'Cualquier estado',
        },
        extra: {
          options: [
            { value: 'scf', label: 'Con financiación SCF' },
            { value: 'scf-unreconciled', label: 'SCF con detalle incompleto' },
            ...(catalog.projects.some((item) => item.scf?.contradiction)
              ? [{ value: 'scf-contradiction', label: 'SCF contradictorio en la fuente' }]
              : []),
            ...unique(catalog.projects.map((item) => item.verificationLevel))
              .map((value) => ({ value: `verified:${value}`, label: value })),
          ],
          label: 'Cualquier evidencia',
        },
      }),
      repositories: () => ({
        category: { options: unique(catalog.repositories.flatMap((item) => item.projectNames)), label: 'Todos los proyectos' },
        status: {
          options: [
            { value: 'directory', label: 'Directory' },
            { value: 'scout-api', label: 'Scout API' },
            { value: 'raven-directory', label: 'Raven' },
            { value: 'catalog-source', label: 'Fuente del catálogo' },
          ],
          label: 'Cualquier fuente',
        },
        extra: {
          options: [
            { value: 'curado', label: 'Asociación curada' },
            { value: 'mencionado', label: 'Solo mencionado en HTML' },
          ],
          label: 'Cualquier evidencia',
        },
      }),
    };

    function matches(item) {
      const query = search.value.trim().toLowerCase();
      const summary = `${item.summaryEn ?? ''} ${item.summaryEs ?? ''} ${item.description ?? ''}`;
      const site = `${item.website ?? ''} ${item.url ?? ''}`;
      const haystack = state.view === 'projects'
        ? `${item.name} ${item.category} ${summary} ${site} ${item.types.join(' ')} ${item.builder ?? ''}`
        : `${item.fullName} ${item.projectNames.join(' ')} ${item.language ?? ''} ${item.sourceType} ${item.associationEvidence ?? ''}`;
      if (query && !haystack.toLowerCase().includes(query)) return false;

      if (category.value !== 'all') {
        const ok = state.view === 'projects'
          ? item.category === category.value
          : item.projectNames.includes(category.value);
        if (!ok) return false;
      }

      if (status.value !== 'all') {
        const ok = state.view === 'projects' ? item.status === status.value : item.sourceType === status.value;
        if (!ok) return false;
      }

      if (extra.value !== 'all') {
        if (state.view === 'projects') {
          if (extra.value === 'scf' && !item.scf?.awarded) return false;
          if (extra.value === 'scf-unreconciled' && item.scf?.detailReconciled !== false) return false;
          if (extra.value === 'scf-contradiction' && !item.scf?.contradiction) return false;
          if (extra.value.startsWith('verified:') && item.verificationLevel !== extra.value.slice(10)) return false;
        } else if (item.associationEvidence !== extra.value) {
          return false;
        }
      }

      return true;
    }

    // Acepta opciones como texto o como { value, label } y las normaliza.
    function fillSelect(select, options, allLabel) {
      const previous = select.value;
      const normalized = options.map((option) => (
        typeof option === 'string' ? { value: option, label: option } : option
      ));
      select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>${normalized
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join('')}`;
      select.value = normalized.some((option) => option.value === previous) ? previous : 'all';
    }

    function buildFilters() {
      const facets = FACETS[state.view]();
      fillSelect(category, facets.category.options, facets.category.label);
      fillSelect(status, facets.status.options, facets.status.label);
      fillSelect(extra, facets.extra.options, facets.extra.label);
    }

    // --------------------------------------------------------------- tarjetas

    const badge = (text, kind) => `<span class="sa-badge ${kind}">${escapeHtml(text)}</span>`;

    const evidenceBadge = (item) => (item.associationEvidence === 'curado'
      ? badge('curado', 'sa-curado')
      : badge('mencionado', ''));

    function projectCard(item) {
      const funded = item.scf?.awarded
        ? `<span class="sa-fund">${escapeHtml(usd(item.scf.totalAwardedUSD) ?? 'SCF')}</span>`
        : '';
      const shownTypes = item.types.slice(0, 3);
      const restTypes = item.types.slice(3);
      const types = shownTypes.map((type) => badge(type, 'sa-type')).join('');
      const extraTypes = restTypes.length
        ? `<span class="sa-badge sa-type" title="${escapeHtml(restTypes.join(', '))}">+${restTypes.length} más</span>`
        : '';
      const summary = summaryFor(item);
      const summaryText = summary.text || 'Sin descripción en la fuente.';
      const site = websiteFor(item);
      let host = '';
      try {
        host = site.value ? new URL(site.value).hostname.replace(/^www\./, '') : '';
      } catch {
        host = '';
      }
      const statusLabel = STATUS_LABEL[item.status] ?? (item.status || 's/d');
      return `
        <article class="sa-card" tabindex="0" data-index="${item.index}" aria-label="Ver ficha de ${escapeHtml(item.name)}">
          <div class="sa-card-body">
            <div class="sa-card-top">
              <span class="sa-tag">${escapeHtml(item.category || 'Sin categoría')}</span>
              <span class="sa-status ${item.status ? '' : 'sa-unknown'}">${escapeHtml(statusLabel)}</span>
            </div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(summaryText)}</p>
            <div class="sa-badges">${funded}${types}${extraTypes}</div>
          </div>
          <div class="sa-card-foot">
            <span>${item.repositoryCount} ${item.repositoryCount === 1 ? 'repo' : 'repos'}${item.curatedRepositoryCount ? ` · ${item.curatedRepositoryCount} curados` : ''}</span>
            <span>${escapeHtml(host || item.statusAsOf || item.observedAt)}</span>
          </div>
        </article>`;
    }

    function repositoryCard(item) {
      const projects = item.projectNames.slice(0, 2).join(', ');
      const extra = item.projectNames.length > 2 ? ` +${item.projectNames.length - 2}` : '';
      const facts = [item.language, item.stars === null || item.stars === undefined ? null : `${item.stars} ★`]
        .filter(Boolean).join(' · ');
      return `
        <article class="sa-card" tabindex="0" data-index="${item.index}" aria-label="Ver ficha de ${escapeHtml(item.fullName)}">
          <div class="sa-card-body">
            <div class="sa-card-top">
              ${evidenceBadge(item)}
              <span class="sa-status ${facts ? '' : 'sa-unknown'}">${escapeHtml(facts || 'sin metadatos')}</span>
            </div>
            <h3 class="sa-mono">${escapeHtml(item.fullName)}</h3>
            <p>${escapeHtml((projects + extra) || 'Sin proyecto asociado')}</p>
          </div>
          <div class="sa-card-foot">
            <span>${item.projectSlugs.length} ${item.projectSlugs.length === 1 ? 'proyecto' : 'proyectos'}</span>
            <span>${escapeHtml(item.lastCommitAt || item.observedAt)}</span>
          </div>
        </article>`;
    }

    // ----------------------------------------------------------------- fichas

    // Valida el valor crudo: escapar antes convertiría `null` en el texto "null".
    // Un objeto `{ html }` se marca como marcado de confianza (solo para `link()`),
    // y `link()` devuelve null cuando la URL no es http(s), así que un `{ html: null }`
    // también cuenta como campo vacío.
    function row(label, value) {
      if (value === null || value === undefined || value === '') return '';
      const html = typeof value === 'object' && 'html' in value ? value.html : escapeHtml(value);
      if (html === null || html === undefined || html === '') return '';
      return `<div><dt>${escapeHtml(label)}</dt><dd>${html}</dd></div>`;
    }

    const section = (title, body) => (body ? `<h4>${escapeHtml(title)}</h4>${body}` : '');

    function scfBlock(scf) {
      if (!scf) return '';

      // La fuente declara que no hubo premio pero registra rondas con importe. No
      // se ocultan ni se suman al total declarado: se muestran como contradicción.
      if (scf.contradiction === 'rounds-without-award') {
        const rows = scf.roundAwards.map((award) => `
          <tr>
            <td>${award.round === null ? 's/d' : escapeHtml(award.round)}</td>
            <td>${escapeHtml(award.awardType || 'Sin tipo')}</td>
            <td class="sa-num">${escapeHtml(award.amountUSD === null ? 'importe no declarado' : usd(award.amountUSD))}</td>
          </tr>`).join('');
        return `
          <p class="sa-warn">La fuente marca este proyecto sin premio, pero registra rondas con importe. No se suman al total declarado porque la fuente se contradice: ${escapeHtml(usd(scf.detailUsd))} quedan fuera del total hasta que se aclare.</p>
          <table class="sa-table"><thead><tr><th>Ronda</th><th>Tipo</th><th class="sa-num">Importe</th></tr></thead><tbody>${rows}</tbody></table>`;
      }

      if (!scf.awarded) return '';

      const rows = scf.roundAwards.map((award) => `
        <tr>
          <td>${award.round === null ? 's/d' : escapeHtml(award.round)}</td>
          <td>${escapeHtml(award.awardType || 'Sin tipo')}</td>
          <td class="sa-num">${escapeHtml(award.amountUSD === null ? 'importe no declarado' : usd(award.amountUSD))}</td>
        </tr>`).join('');
      const table = rows
        ? `<table class="sa-table"><thead><tr><th>Ronda</th><th>Tipo</th><th class="sa-num">Importe</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="sa-prose">La fuente declara un total pero no registra las rondas.</p>';
      const warning = scf.detailReconciled
        ? ''
        : `<p class="sa-warn">El detalle no cuadra con el total declarado: las rondas suman ${escapeHtml(usd(scf.detailUsd))} y la fuente declara ${escapeHtml(usd(scf.totalAwardedUSD))}. Se muestra el total oficial y el desglose está incompleto.</p>`;
      return `
        <dl>
          ${row('Total declarado', usd(scf.totalAwardedUSD) ?? 's/d')}
          ${row('Rondas', scf.rounds.length ? scf.rounds.join(', ') : null)}
          ${row('Base', scf.basis)}
          ${row('Fecha', scf.asOf)}
          ${row('Fuente', { html: link(scf.sourceUrl, scf.sourceUrl) })}
        </dl>${warning}${table}`;
    }

    function projectDetail(item) {
      // El nombre del repo abre su documentación; el enlace aparte va a GitHub.
      const repoList = item.repositories.map((entry) => `
        <li>
          <button type="button" class="sa-repo-link" data-repo-url="${escapeHtml(entry.url)}">${escapeHtml(entry.url)}</button>
          <span class="sa-ev">${escapeHtml(entry.evidence)}</span>
          ${link(entry.url, 'GitHub')}
        </li>`).join('');
      const site = websiteFor(item);
      const siteBasisLabel = site.basis === 'project-url'
        ? 'Web oficial (fuente)'
        : site.basis === 'curated'
          ? 'Web (capa curada)'
          : site.basis === 'status-source'
            ? 'Web (fuente de estado)'
            : 'Web';
      const links = [
        row(siteBasisLabel, { html: link(site.value, site.value) ?? escapeHtml(site.value) }),
        row('Twitter', { html: link(item.twitter, item.twitter) }),
        row('Organización', { html: link(item.githubOrg, item.githubOrg) }),
        row('Ficha de origen', { html: link(item.evidenceUrl, item.evidenceUrl) }),
      ].join('');
      const evidence = [
        row('Estado', item.status),
        row('Estado al', item.statusAsOf),
        row('Base del estado', item.statusBasis),
        row('Fuente del estado', { html: link(item.statusSourceUrl, item.statusSourceUrl) ?? escapeHtml(item.statusSourceUrl) }),
        row('Verificación', item.verificationLevel),
        row('Origen del registro', item.provenanceSource),
        row('Nivel de evidencia', item.evidenceLevel),
        row('Resumen EN', item.summaryEnStatus ?? (item.summaryEn ? 'source' : 'pending')),
        row('Resumen ES', item.summaryEsStatus ?? (item.summaryEs ? 'curated' : 'pending')),
        row('Registro actualizado', item.updatedAt),
        row('Extraído el', item.observedAt),
      ].join('');
      const summary = summaryFor(item);
      const summaryNote = summary.text && summary.pending
        ? `<p class="sa-warn">${summary.fallback === 'en' ? 'Solo se dispone del resumen en inglés. La traducción al español está pendiente y no se inventa.' : 'Solo se dispone del resumen en español. La versión en inglés está pendiente.'}</p>`
        : '';
      const summaryHtml = summary.text
        ? `<p class="sa-prose">${escapeHtml(summary.text)}</p>${summaryNote}`
        : '<p class="sa-prose">Sin descripción en la fuente.</p>';
      const altSummary = state.lang === 'es' ? item.summaryEn : item.summaryEs;
      const altHtml = summary.text && altSummary && altSummary !== summary.text
        ? `<p class="sa-prose sa-alt">${escapeHtml(altSummary)}</p>`
        : '';

      return `
        ${summaryHtml}${altHtml}
        <dl>
          ${row('Categoría', item.category)}
          ${row('Tipos', { html: item.types.map((type) => `<span class="sa-badge sa-type">${escapeHtml(type)}</span>`).join(' ') })}
          ${row('Región', item.region)}
          ${row('Builder', item.builder)}
          ${row('Repositorios', item.repositoryCount > 0
            ? `${item.repositoryCount}${item.curatedRepositoryCount ? ` (${item.curatedRepositoryCount} curados)` : ''}`
            : 'ninguno en la fuente')}
        </dl>
        ${section('Enlaces', links ? `<dl>${links}</dl>` : '')}
        ${section('Evidencia del estado', evidence ? `<dl>${evidence}</dl>` : '')}
        ${section('Financiación SCF', scfBlock(item.scf))}
        ${section(`Repositorios (${item.repositoryCount})`, repoList ? `<ul class="sa-link-list">${repoList}</ul>` : '<p class="sa-prose">La fuente no le asocia ningún repositorio.</p>')}`;
    }

    // ------------------------------------------------- doc de repositorio (API-style)

    // Al pulsar un repositorio se explica qué registra la fuente sobre él, con el
    // formato de documentación de API: endpoint, campos, tipos y límites.
    //
    // No describe el funcionamiento técnico del repositorio: no lo hemos leído.
    // Lo que hace es declarar qué se sabe, de dónde salió cada campo y qué NO se
    // puede afirmar con esta evidencia. Un `null` significa que la fuente no lo
    // publica, nunca que el dato sea cero o falso.

    // Fila de tabla de documentación: nombre del campo, tipo y valor leído.
    const field = (name, type, value) => `
      <tr>
        <td class="sa-mono">${escapeHtml(name)}</td>
        <td class="sa-mono sa-type">${escapeHtml(type)}</td>
        <td>${value === null || value === undefined || value === ''
          ? '<span class="sa-nil">null</span>'
          : escapeHtml(String(value))}</td>
      </tr>`;

    function repoDoc(item) {
      if (!item) return '';

      const isSource = item.role === 'catalog-source';
      const sourceType = item.sourceType ?? null;
      const sourceText = SOURCE_LABEL[sourceType] ?? sourceType ?? 'no declarada';

      const associations = item.associations.map((entry) => {
        const name = catalog.projects.find((project) => project.slug === entry.slug)?.name ?? entry.slug;
        return `<li><span class="sa-mono">${escapeHtml(entry.slug)}</span> · ${escapeHtml(name)}
          <span class="sa-ev">${escapeHtml(entry.evidence)}</span></li>`;
      }).join('');

      const openGitHub = `<p class="sa-prose">La fuente publica el repositorio pero no su documentación.
        Para leer el código, la licencia o los issues hay que ir a GitHub:</p>
        <p>${link(item.url, item.fullName) ?? escapeHtml(item.url)}</p>`;

      return `
        <p class="sa-doc-route"><span class="sa-mono">GET</span> /repos/${escapeHtml(item.fullName)}</p>

        ${section('Qué es este registro', `
          <p class="sa-prose">Una entrada del catálogo unificado de Atlas: una URL de repositorio
          deduplicada, con los proyectos a los que la fuente lo asocia y la evidencia de cada
          asociación. Un registro aquí no significa que el repositorio sea maintained, seguro,
          esté desplegado en mainnet ni pertenezca a una empresa.</p>
          <p class="sa-prose">${isSource
            ? escapeHtml(ROLE_LABEL['catalog-source'])
            : `Aparece en el catálogo con ${item.projectSlugs.length} ${item.projectSlugs.length === 1 ? 'proyecto asociado' : 'proyectos asociados'}.`}</p>`)}

        ${section('Identidad', `
          <table class="sa-doc">
            <thead><tr><th>Campo</th><th>Tipo</th><th>Valor</th></tr></thead>
            <tbody>
              ${field('fullName', 'string', item.fullName)}
              ${field('url', 'url', item.url)}
              ${field('source', 'enum', sourceType)}
              ${field('role', 'enum', item.role)}
              ${field('observedAt', 'date', item.observedAt)}
            </tbody>
          </table>
          <p class="sa-prose">Origen de la fuente: ${escapeHtml(sourceText)}.</p>`)}

        ${!isSource && section('Asociación con proyectos', `
          <p class="sa-prose">El nivel de evidencia declara cómo se obtuvo el vínculo, no si el
          proyecto mantiene el repositorio:</p>
          <p class="sa-prose"><span class="sa-ev">${escapeHtml(item.associationEvidence)}</span>
          ${escapeHtml(EVIDENCE_LABEL[item.associationEvidence] ?? 'Nivel no reconocido.')}</p>
          ${associations ? `<ul class="sa-link-list">${associations}</ul>` : ''}`)}

        ${section('Metadatos observados', `
          <table class="sa-doc">
            <thead><tr><th>Campo</th><th>Tipo</th><th>Valor</th></tr></thead>
            <tbody>
              ${field('language', 'string | null', item.language)}
              ${field('stars', 'int | null', item.stars)}
              ${field('lastCommitAt', 'date | null', item.lastCommitAt)}
            </tbody>
          </table>
          <p class="sa-prose">Un <span class="sa-nil">null</span> significa que la fuente no publica ese
          dato. Es una foto del momento de la extracción: las estrellas y la fecha del último commit
          no miden calidad, seguridad ni actividad reciente del proyecto.</p>`)}

        ${section('Lo que este registro NO demuestra', `
          <ul class="sa-prose">
            <li>No declara licencia, ni Deployment en mainnet, ni auditoría.</li>
            <li>No demuestra que el repositorio siga mantenido ni que el proyecto lo use en producción.</li>
            <li>No establece relación societaria, recorrido ni propiedad.</li>
            <li>Un repositorio mencionado en una ficha puede ser de un tercero o periférico.</li>
          </ul>`)}

        ${section('Verificar por tu cuenta', openGitHub)}`;
    }

    // Buscar el registro completo de repositorio a partir de la URL que aparece en
    // la lista de repositorios de la ficha de un proyecto.
    const repoByUrl = new Map(catalog.repositories.map((repo) => [repo.url, repo]));

    // showModal() lanza si el <dialog> ya está abierto (al navegar de una ficha de
    // proyecto a la de un repositorio). Se reutiliza el mismo diálogo abierto.
    const showDialog = () => {
      if (!dialog.open) dialog.showModal();
      dialogBody.scrollTop = 0;
    };

    function openRepoDoc(url, title) {
      const item = repoByUrl.get(url);
      if (!item) return false;
      dialogTitle.textContent = title ?? item.fullName;
      dialogBody.innerHTML = repoDoc(item);
      showDialog();
      return true;
    }

    // ---------------------------------------------------------------- render

    function openDetail(index) {
      const item = currentEntities()[index];
      if (!item) return;
      dialogTitle.textContent = state.view === 'projects' ? item.name : item.fullName;
      dialogBody.innerHTML = state.view === 'projects' ? projectDetail(item) : repoDoc(item);
      bindRepoLinks();
      showDialog();
    }

    // Los nombres de repositorio abren su documentación sin cerrar el diálogo.
    function bindRepoLinks() {
      dialogBody.querySelectorAll('.sa-repo-link').forEach((button) => {
        button.addEventListener('click', () => openRepoDoc(button.dataset.repoUrl));
      });
    }

    function render() {
      const entities = currentEntities();
      const visible = entities.map((item, index) => ({ ...item, index })).filter(matches);
      const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;
      const start = (state.page - 1) * PAGE_SIZE;
      const slice = visible.slice(start, start + PAGE_SIZE);

      count.textContent = `${visible.length} ${visible.length === 1 ? NOUN[state.view] : `${NOUN[state.view]}s`}`;
      empty.hidden = visible.length !== 0;
      empty.textContent = `No hay ${NOUN[state.view]}s que coincidan. Se puede borrar un filtro.`;
      grid.innerHTML = slice.map(state.view === 'projects' ? projectCard : repositoryCard).join('');

      renderPager(visible.length, totalPages);

      grid.querySelectorAll('.sa-card').forEach((card) => {
        const open = () => openDetail(Number(card.dataset.index));
        card.addEventListener('click', open);
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        });
      });
    }

    // Ventana de números: primera, última y vecinas de la actual.
    function pageWindow(current, total) {
      const keep = new Set([1, total, current - 1, current, current + 1]);
      return [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    }

    function renderPager(total, totalPages) {
      pager.hidden = total === 0;
      prev.disabled = state.page <= 1;
      next.disabled = state.page >= totalPages;
      const from = total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
      const to = Math.min(total, state.page * PAGE_SIZE);
      pageInfo.textContent = total === 0
        ? 'Sin resultados'
        : `Página ${state.page} de ${totalPages} · ${from}–${to} de ${total}`;
      pageNums.innerHTML = pageWindow(state.page, totalPages).map((n) => (
        `<button type="button" data-sa-page="${n}" aria-label="Ir a la página ${n}" aria-current="${n === state.page ? 'page' : 'false'}"${n === state.page ? ' disabled' : ''}>${n}</button>`
      )).join('');
      pageNums.querySelectorAll('[data-sa-page]').forEach((button) => {
        button.addEventListener('click', () => setPage(Number(button.dataset.saPage)));
      });
    }

    // Cambia de página y devuelve el foco al inicio de los resultados.
    function setPage(page) {
      const entities = currentEntities();
      const total = entities.map((item, index) => ({ ...item, index })).filter(matches).length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      state.page = Math.min(Math.max(1, page), totalPages);
      render();
      const controls = root.querySelector('[data-sa="count"]');
      if (controls && typeof controls.scrollIntoView === 'function') {
        try {
          controls.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // El cambio de página ya se aplicó; el desplazamiento es accesorio.
        }
      }
    }

    function setView(view) {
      state.view = view;
      state.page = 1;
      root.querySelectorAll('[data-sa-view]').forEach((button) => {
        button.setAttribute('aria-selected', String(button.dataset.saView === view));
      });
      buildFilters();
      render();
    }

    function setLang(lang) {
      if (lang !== 'es' && lang !== 'en') return;
      state.lang = lang;
      state.page = 1;
      try {
        global.localStorage?.setItem('sa-lang', lang);
      } catch {
        // El idioma sigue funcionando en memoria aunque el almacenamiento falle.
      }
      root.querySelectorAll('[data-sa-lang]').forEach((button) => {
        button.setAttribute('aria-selected', String(button.dataset.saLang === lang));
      });
      search.placeholder = lang === 'es'
        ? 'Nombre, descripción, repositorio…'
        : 'Name, description, repository…';
      render();
    }

    // Aplica un filtro por nombre (`search`, `category`, `status`, `extra`) desde
    // fuera del componente. Lo usan los enlaces de la landing para que "Proyectos
    // con SCF" abra el explorador con el filtro puesto en vez de saltar a otra página.
    function setFilter(name, value) {
      const control = { search, category, status, extra }[name];
      if (!control) return;
      // El filtro puede no existir todavía si la vista activa no ofrece esa opción.
      const exists = Array.from(control.options).some((option) => option.value === value);
      if (name !== 'search' && !exists) return;
      control.value = value;
      state.page = 1;
      render();
    }

    root.querySelectorAll('[data-sa-view]').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.saView));
    });
    root.querySelectorAll('[data-sa-lang]').forEach((button) => {
      button.addEventListener('click', () => setLang(button.dataset.saLang));
    });
    [search, category, status, extra].forEach((control) => control.addEventListener('input', () => {
      state.page = 1;
      render();
    }));
    clearBtn.addEventListener('click', () => {
      search.value = '';
      category.value = 'all';
      status.value = 'all';
      extra.value = 'all';
      state.page = 1;
      render();
    });
    prev.addEventListener('click', () => setPage(state.page - 1));
    next.addEventListener('click', () => setPage(state.page + 1));
    closeBtn.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    buildFilters();
    setLang(state.lang);
    render();

    // Oculta o muestra la fila de resumen sin volver a renderizar. Se usa cuando
    // la página anfitriona ya publica las mismas cifras.
    function setShowStats(visible) {
      stats.hidden = !visible;
    }

    return { setView, setFilter, openDetail, openRepoDoc, setShowStats, setLang, setPage };
  }

  // El markup vive en un <template> para que el JS no dependa de ids globales: cada
  // instancia clona el template dentro de su host. Los <label> envuelven a su control
  // en lugar de usar `for`, porque dos instancias en la misma página no pueden
  // compartir ids.
  const MARKUP = `
    <dl data-sa="stats" class="sa-stats" aria-label="Resumen del catálogo"></dl>

    <div class="sa-controls" role="search" aria-label="Filtros del catálogo">
      <div class="sa-row">
        <div class="sa-field sa-grow">
          <label>Buscar
            <input data-sa="search" type="search" placeholder="Nombre, descripción, repositorio…" autocomplete="off">
          </label>
        </div>
        <div class="sa-field">
          <label>Categoría
            <select data-sa="category"></select>
          </label>
        </div>
        <div class="sa-field">
          <label>Estado
            <select data-sa="status"></select>
          </label>
        </div>
        <div class="sa-field">
          <label>Evidencia
            <select data-sa="extra"></select>
          </label>
        </div>
        <button data-sa="clear" type="button">Limpiar</button>
      </div>

      <div class="sa-row sa-views">
        <div class="sa-tabs" role="tablist" aria-label="Colección">
          <button role="tab" type="button" data-sa-view="projects" aria-selected="true">Proyectos</button>
          <button role="tab" type="button" data-sa-view="repositories" aria-selected="false">Repositorios</button>
        </div>
        <div class="sa-tabs sa-lang" role="tablist" aria-label="Idioma del resumen">
          <button role="tab" type="button" data-sa-lang="es" aria-selected="true">ES</button>
          <button role="tab" type="button" data-sa-lang="en" aria-selected="false">EN</button>
        </div>
        <p data-sa="count" class="sa-count" role="status" aria-live="polite"></p>
      </div>
    </div>

    <p data-sa="empty" class="sa-empty" hidden></p>
    <div data-sa="grid" class="sa-grid" aria-label="Resultados"></div>
    <nav data-sa="pager" class="sa-pager" aria-label="Paginación de resultados">
      <button data-sa="prev" type="button">← Anterior</button>
      <div data-sa="page-nums" class="sa-page-nums"></div>
      <p data-sa="page-info" class="sa-page-info" role="status" aria-live="polite"></p>
      <button data-sa="next" type="button">Siguiente →</button>
    </nav>

    <dialog data-sa="dialog" class="sa-dialog">
      <article class="sa-sheet">
        <header class="sa-sheet-head">
          <h2 data-sa="dialog-title"></h2>
          <button data-sa="dialog-close" type="button" aria-label="Cerrar ficha">&times;</button>
        </header>
        <div data-sa="dialog-body"></div>
      </article>
    </dialog>`;

  // Monta el explorador dentro de `host`. Devuelve la instancia o null si falta
  // el catálogo, para que la página pueda mostrar su propio mensaje de error.
  //
  // `options.showStats` controla la fila de resumen. Por defecto se muestra, que
  // es lo que quiere la página suelta. La landing la apaga: ya tiene su propia
  // barra de cifras en el hero y repetirla dos pantallas más abajo además
  // mostraría 1.142 frente a los 1.133 canónicos que anuncia esa barra.
  function mount(host, catalog, options) {
    if (!host) return null;
    if (!catalog) {
      host.innerHTML = '<p class="sa-fallback">No se encontró el catálogo. Ejecuta <span class="sa-code">node scripts/build-app-catalog.mjs</span> para generarlo.</p>';
      return null;
    }
    host.insertAdjacentHTML('beforeend', MARKUP);
    const instance = createExplorer(catalog, host);
    if (instance && options && options.showStats === false) {
      instance.setShowStats(false);
    }
    return instance;
  }

  global.StellarAtlas = { mount, MARKUP };
}(window));
