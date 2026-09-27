// ATLAS — capa de datos vanilla, preparada para backend.
// Lee window.tellusCatalog y expone un modelo Repository normalizado.
// No inventa datos: lo que la fuente no publica viaja como null.
// Los programas sin fuente concluyente se marcan como sample.

(function initAtlasData(global) {
  'use strict';

  var TYPE_TO_CATEGORY = {
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
    Yield: 'DeFi'
  };

  var CATEGORY_ORDER = [
    'Payments', 'DeFi', 'Wallets', 'Infrastructure', 'Developer Tools',
    'Identity', 'Gaming', 'NFT', 'AI', 'Social', 'Education', 'Other'
  ];

  var PROGRAMS = [
    { slug: 'scf', name: 'Stellar Community Fund', short: 'SCF', type: 'grant', sample: false,
      description: 'Programa de financiación por rondas de la comunidad Stellar. Datos con evidencia en el catálogo.' },
    { slug: 'instawards', name: 'InstaWards', short: 'INSTAWARDS', type: 'award', sample: true,
      description: 'Datos demostrativos. Sin fuente concluyente en el catálogo actual.' },
    { slug: 'sdf', name: 'SDF Ecosystem Programs', short: 'SDF', type: 'grant', sample: true,
      description: 'Datos demostrativos. Programas del ecosistema SDF.' },
    { slug: 'hackathon', name: 'Hackathons', short: 'HACKATHON', type: 'hackathon', sample: true,
      description: 'Datos demostrativos. Participaciones en hackathons.' },
    { slug: 'community', name: 'Community', short: 'COMMUNITY', type: 'community', sample: true,
      description: 'Datos demostrativos. Iniciativas comunitarias.' }
  ];

  function slugifyRepo(fullName) {
    return String(fullName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function mapStatus(projectStatus, isArchived) {
    if (isArchived === true || projectStatus === 'Inactive') return 'archived';
    if (projectStatus === 'Draft' || projectStatus === 'Development' || projectStatus === 'Pre-Release') return 'experimental';
    return 'active';
  }

  function categoriesFor(project) {
    var out = [];
    (project.types || []).forEach(function (t) {
      var c = TYPE_TO_CATEGORY[t] || null;
      if (c && out.indexOf(c) === -1) out.push(c);
    });
    if (!out.length) {
      var cat = project.category || null;
      if (cat === 'User-Facing App') out.push('Wallets');
      else if (cat === 'Protocol/Contract') out.push('DeFi');
      else if (cat === 'Infrastructure') out.push('Infrastructure');
      else if (cat === 'Tooling') out.push('Developer Tools');
      else if (cat === 'Anchor') out.push('Infrastructure');
      else if (cat === 'Asset') out.push('Payments');
      else if (cat === 'Partner Integration') out.push('Infrastructure');
      else out.push('Other');
    }
    return out;
  }

  function programsFor(project) {
    var programs = [];
    if (project.scf && project.scf.awarded) {
      programs.push({
        name: 'Stellar Community Fund', slug: 'scf', type: 'grant',
        year: project.scf.rounds && project.scf.rounds.length ? null : null,
        result: 'Award',
        amount: project.scf.totalAwardedUSD ?? null, currency: 'USD'
      });
    }
    return programs;
  }

  function buildRepositories(catalog) {
    var projectBySlug = {};
    (catalog.projects || []).forEach(function (p) { projectBySlug[p.slug] = p; });
    return (catalog.repositories || []).map(function (r) {
      var primarySlug = (r.projectSlugs && r.projectSlugs[0]) || null;
      var project = primarySlug ? projectBySlug[primarySlug] : null;
      var owner = String(r.fullName || '').split('/')[0] || null;
      var categories = project ? categoriesFor(project) : ['Other'];
      var programs = project ? programsFor(project) : [];
      var repoArchived = null;
      return {
        id: r.id, slug: slugifyRepo(r.fullName),
        name: r.fullName, description: project ? (project.description || project.summaryEn || '') : '',
        longDescription: project ? (project.summaryEn || project.description || '') : '',
        repositoryUrl: r.url, websiteUrl: project ? (project.website || project.url || null) : null,
        organization: owner ? { name: owner, slug: owner.toLowerCase(), url: 'https://github.com/' + owner } : null,
        category: categories, languages: r.language ? [{ name: r.language }] : [], primaryLanguage: r.language || null,
        status: mapStatus(project ? project.status : null, repoArchived),
        isOpenSource: true, stars: r.stars ?? null, forks: null, license: null,
        createdAt: null, updatedAt: r.lastCommitAt || r.observedAt || null,
        programs: programs, builders: [], technologies: project ? (project.types || []) : [],
        fundingHistory: project && project.scf && project.scf.awarded
          ? (project.scf.roundAwards || []).map(function (a) {
              return { year: null, program: 'Stellar Community Fund', type: 'grant', result: a.awardType || 'Award', amount: a.amountUSD ?? null };
            }) : [],
        projectSlug: primarySlug, projectName: project ? project.name : (r.projectNames && r.projectNames[0]) || null,
        projectStatus: project ? project.status : null, evidence: r.associationEvidence || null,
        sourceType: r.sourceType || null, observedAt: r.observedAt || null
      };
    });
  }

  function filterRepositories(repos, f) {
    var q = (f.q || '').trim().toLowerCase();
    return repos.filter(function (r) {
      if (q) {
        var hay = [r.name, r.description, r.projectName, r.organization && r.organization.name, r.primaryLanguage,
          (r.category || []).join(' '), (r.technologies || []).join(' '), (r.programs || []).map(function (p) { return p.name; }).join(' ')
        ].filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (f.category && f.category !== 'all') {
        if ((r.category || []).indexOf(f.category) === -1) return false;
      }
      if (f.program && f.program !== 'all') {
        if (!(r.programs || []).some(function (p) { return p.slug === f.program; })) return false;
      }
      if (f.language && f.language !== 'all') {
        if ((r.primaryLanguage || '').toLowerCase() !== String(f.language).toLowerCase()) return false;
      }
      if (f.status && f.status !== 'all') {
        if (r.status !== f.status) return false;
      }
      if (f.repoType && f.repoType !== 'all') {
        if (f.repoType === 'archived' && r.status !== 'archived') return false;
        if (f.repoType === 'open-source' && !r.isOpenSource) return false;
      }
      return true;
    });
  }

  function sortRepositories(repos, sort) {
    var arr = repos.slice();
    if (sort === 'stars') arr.sort(function (a, b) { return (b.stars || 0) - (a.stars || 0); });
    else if (sort === 'newest') arr.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    else if (sort === 'oldest') arr.sort(function (a, b) { return String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')); });
    else if (sort === 'az') arr.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    else arr.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    return arr;
  }

  function paginate(items, page, limit) {
    var total = items.length;
    var pages = Math.max(1, Math.ceil(total / limit));
    var p = Math.min(Math.max(1, page), pages);
    var start = (p - 1) * limit;
    return { data: items.slice(start, start + limit), pagination: { page: p, limit: limit, total: total, pages: pages } };
  }

  // Ventana de paginación: máximo ~7-9 elementos con ellipsis.
  function pageWindow(current, total) {
    if (total <= 7) {
      var all = []; for (var i = 1; i <= total; i++) all.push(i); return all;
    }
    var keep = {};
    [1, 2, current - 1, current, current + 1, total - 1, total].forEach(function (n) {
      if (n >= 1 && n <= total) keep[n] = true;
    });
    var nums = Object.keys(keep).map(Number).sort(function (a, b) { return a - b; });
    var out = []; var prev = 0;
    nums.forEach(function (n) {
      if (prev && n - prev > 1) out.push('…');
      out.push(n); prev = n;
    });
    return out;
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 30) { var d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago'); }
    if (s < 86400 * 365) { var m = Math.floor(s / (86400 * 30)); return m + (m === 1 ? ' month ago' : ' months ago'); }
    var y = Math.floor(s / (86400 * 365)); return y + (y === 1 ? ' year ago' : ' years ago');
  }

  global.AtlasData = {
    PROGRAMS: PROGRAMS, CATEGORY_ORDER: CATEGORY_ORDER,
    buildRepositories: buildRepositories, filterRepositories: filterRepositories,
    sortRepositories: sortRepositories, paginate: paginate, pageWindow: pageWindow, timeAgo: timeAgo
  };
})(window);
