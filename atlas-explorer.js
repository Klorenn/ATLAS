// ATLAS Explorer v2 — tabla editorial, filtros combinables, URL state, paginación real.
// Depende de: window.tellusCatalog + window.AtlasData. Clásico (file:// compatible).

(function initAtlasExplorer(global) {
  'use strict';

  var DEBOUNCE_MS = 300;
  var DEFAULT_LIMIT = 24;

  function escapeHtml(v) {
    return String(v == null ? '' : v).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  function safeUrl(v) {
    if (typeof v !== 'string' || !v) return null;
    try { var u = new URL(v); return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null; }
    catch (e) { return null; }
  }

  function readParams() {
    var p = new URLSearchParams(global.location.search || '');
    return {
      q: p.get('q') || '', category: p.get('category') || 'all', program: p.get('program') || 'all',
      language: p.get('language') || 'all', status: p.get('status') || 'all',
      repoType: p.get('repoType') || 'all', sort: p.get('sort') || 'updated',
      view: p.get('view') === 'grid' ? 'grid' : 'list',
      page: Math.max(1, parseInt(p.get('page') || '1', 10) || 1),
      limit: [24, 48, 96].indexOf(parseInt(p.get('limit') || '24', 10)) !== -1 ? parseInt(p.get('limit') || '24', 10) : DEFAULT_LIMIT
    };
  }

  function writeParams(s, replace) {
    var p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.category !== 'all') p.set('category', s.category);
    if (s.program !== 'all') p.set('program', s.program);
    if (s.language !== 'all') p.set('language', s.language);
    if (s.status !== 'all') p.set('status', s.status);
    if (s.repoType !== 'all') p.set('repoType', s.repoType);
    if (s.sort !== 'updated') p.set('sort', s.sort);
    if (s.view !== 'list') p.set('view', s.view);
    if (s.page !== 1) p.set('page', String(s.page));
    if (s.limit !== DEFAULT_LIMIT) p.set('limit', String(s.limit));
    var url = global.location.pathname + (p.toString() ? '?' + p.toString() : '') + (global.location.hash || '');
    if (replace) global.history.replaceState(null, '', url);
    else global.history.pushState(null, '', url);
  }

  function badge(text) { return '<span class="badge">' + escapeHtml(text) + '</span>'; }

  function programBadges(repo) {
    return (repo.programs || []).map(function (p) {
      var label = p.slug === 'scf' ? 'SCF' : p.name;
      return badge(label);
    }).join('');
  }

  function rowHtml(r) {
    var detailUrl = 'repository.html?slug=' + encodeURIComponent(r.slug);
    var stars = r.stars == null ? '—' : String(r.stars);
    var lang = r.primaryLanguage || '—';
    var cat = (r.category && r.category[0]) || 'Other';
    return '<tr data-slug="' + escapeHtml(r.slug) + '" tabindex="0" aria-label="Abrir ' + escapeHtml(r.name) + '">' +
      '<td class="cell-project"><b>' + escapeHtml(r.name) + '</b>' +
      '<span class="desc">' + escapeHtml((r.description || '').slice(0, 140)) + '</span>' +
      (r.organization ? '<span class="org">' + escapeHtml(r.organization.name) + '</span>' : '') + '</td>' +
      '<td>' + escapeHtml(cat) + '</td>' +
      '<td>' + (programBadges(r) || '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' + escapeHtml(lang) + '</td>' +
      '<td class="stars">' + escapeHtml(stars) + '</td>' +
      '<td>' + escapeHtml(global.AtlasData.timeAgo(r.updatedAt)) + '</td>' +
      '<td>' + badge(r.status) + '</td>' +
      '<td><a class="go" href="' + detailUrl + '" aria-label="Abrir detalle">↗</a></td></tr>';
  }

  function mobileRowHtml(r) {
    var detailUrl = 'repository.html?slug=' + encodeURIComponent(r.slug);
    return '<tr data-slug="' + escapeHtml(r.slug) + '" tabindex="0">' +
      '<td><b style="font-size:16px">' + escapeHtml(r.name) + '</b> <a class="go" href="' + detailUrl + '">↗</a>' +
      '<span class="desc">' + escapeHtml((r.description || '').slice(0, 120)) + '</span></td>' +
      '<td class="cell-meta">' + programBadges(r) + '<span>· ' + escapeHtml(r.primaryLanguage || '—') +
      ' · ' + escapeHtml(r.stars == null ? '—' : r.stars + ' ★') + '</span>' +
      '<span>Updated ' + escapeHtml(global.AtlasData.timeAgo(r.updatedAt)) + '</span></td></tr>';
  }

  function cardHtml(r) {
    var detailUrl = 'repository.html?slug=' + encodeURIComponent(r.slug);
    return '<article class="repo-card" data-slug="' + escapeHtml(r.slug) + '" tabindex="0" aria-label="Abrir ' + escapeHtml(r.name) + '">' +
      '<h3>' + escapeHtml(r.name) + '</h3><p class="desc">' + escapeHtml((r.description || '').slice(0, 160)) + '</p>' +
      '<div class="meta">' + programBadges(r) + badge((r.category && r.category[0]) || 'Other') +
      '<span>' + escapeHtml(r.primaryLanguage || '—') + '</span><span>' + escapeHtml(r.stars == null ? '—' : r.stars + ' ★') + '</span>' +
      '<span>' + escapeHtml(global.AtlasData.timeAgo(r.updatedAt)) + '</span></div>' +
      '<div style="margin-top:12px"><a href="' + detailUrl + '">Abrir ficha ↗</a></div></article>';
  }

  function skeletonHtml() {
    var s = '';
    for (var i = 0; i < 9; i++) s += '<div class="skeleton-row" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>';
    return s;
  }

  function mount(host) {
    var catalog = global.tellusCatalog;
    if (!host) return null;
    if (!catalog || !global.AtlasData) {
      host.innerHTML = '<div class="error-box" role="alert"><h3>We couldn\'t load the ecosystem.</h3><p>Try again.</p><button class="btn btn-secondary" onclick="location.reload()">Retry</button></div>';
      return null;
    }
    var all = global.AtlasData.buildRepositories(catalog);
    var state = readParams();
    var debounce = null;

    host.innerHTML =
      '<div role="search" aria-label="Repository search">' +
      '<div class="searchbar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
      '<input id="ax-q" type="search" placeholder="Search repositories, projects or builders..." autocomplete="off" aria-label="Search repositories, projects or builders" value="' + escapeHtml(state.q) + '">' +
      '<span class="kbd" aria-hidden="true">⌘ K</span></div>' +
      '<div class="filter-row" role="group" aria-label="Filters">' +
      '<select id="ax-program" aria-label="Funding program"><option value="all">All programs</option><option value="scf">Stellar Community Fund</option><option value="instawards">InstaWards</option><option value="sdf">SDF</option><option value="hackathon">Hackathon</option><option value="community">Community</option></select>' +
      '<select id="ax-category" aria-label="Category"><option value="all">All categories</option></select>' +
      '<select id="ax-language" aria-label="Language"><option value="all">All languages</option></select>' +
      '<select id="ax-status" aria-label="Status"><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option><option value="experimental">Experimental</option></select>' +
      '<select id="ax-type" aria-label="Repository type"><option value="all">All types</option><option value="open-source">Open Source</option><option value="archived">Archived</option></select>' +
      '<select id="ax-sort" aria-label="Sort by"><option value="updated">Recently updated</option><option value="stars">Most starred</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="az">A–Z</option></select>' +
      '<button class="btn btn-secondary filters-btn" id="ax-filters-btn" type="button">Filters <span id="ax-filter-count"></span></button>' +
      '</div><div class="active-filters" id="ax-active"></div>' +
      '<div class="results-bar"><p class="results-count" id="ax-count" role="status" aria-live="polite"></p>' +
      '<div style="display:flex;gap:10px;align-items:center"><div class="view-toggle" role="group" aria-label="View"><button id="ax-list" aria-pressed="true">List</button><button id="ax-grid" aria-pressed="false">Grid</button></div></div></div>' +
      '<div id="ax-results" aria-live="polite"></div>' +
      '<nav class="pager" id="ax-pager" aria-label="Pagination"></nav></div>';

    var q = host.querySelector('#ax-q'), program = host.querySelector('#ax-program'),
      category = host.querySelector('#ax-category'), language = host.querySelector('#ax-language'),
      status = host.querySelector('#ax-status'), repoType = host.querySelector('#ax-type'),
      sort = host.querySelector('#ax-sort'), results = host.querySelector('#ax-results'),
      pager = host.querySelector('#ax-pager'), count = host.querySelector('#ax-count'),
      active = host.querySelector('#ax-active'), listBtn = host.querySelector('#ax-list'),
      gridBtn = host.querySelector('#ax-grid'), filterCount = host.querySelector('#ax-filter-count');

    var cats = {}, langs = {};
    all.forEach(function (r) { (r.category || []).forEach(function (c) { cats[c] = true; }); if (r.primaryLanguage) langs[r.primaryLanguage] = true; });
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; category.appendChild(o);
    });
    Object.keys(langs).sort().forEach(function (l) {
      var o = document.createElement('option'); o.value = l; o.textContent = l; language.appendChild(o);
    });

    program.value = state.program; category.value = state.category; language.value = state.language;
    status.value = state.status; repoType.value = state.repoType; sort.value = state.sort;
    syncView();

    function activeFilterCount() {
      var n = 0;
      if (state.q) n++;
      ['category', 'program', 'language', 'status', 'repoType'].forEach(function (k) { if (state[k] !== 'all') n++; });
      return n;
    }

    function renderActive() {
      var parts = [];
      if (state.q) parts.push({ k: 'q', label: '“' + state.q + '”' });
      ['category', 'program', 'language', 'status', 'repoType'].forEach(function (k) {
        if (state[k] !== 'all') parts.push({ k: k, label: state[k] });
      });
      var n = activeFilterCount();
      filterCount.textContent = n ? String(n) : '';
      if (!parts.length) { active.innerHTML = ''; return; }
      active.innerHTML = '<span>' + n + ' active filter' + (n === 1 ? '' : 's') + ':</span> ' +
        parts.map(function (p) { return '<span class="chip">' + escapeHtml(p.label) + '<button data-clear="' + p.k + '" aria-label="Remove filter">×</button></span>'; }).join('') +
        ' <button class="btn btn-secondary" id="ax-clear" style="padding:6px 12px">Clear all</button>';
      var clear = active.querySelector('#ax-clear');
      if (clear) clear.addEventListener('click', clearAll);
      active.querySelectorAll('[data-clear]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-clear');
          if (k === 'q') { state.q = ''; q.value = ''; }
          else { state[k] = 'all'; syncControls(); }
          state.page = 1; sync();
        });
      });
    }

    function syncControls() {
      program.value = state.program; category.value = state.category; language.value = state.language;
      status.value = state.status; repoType.value = state.repoType; sort.value = state.sort;
    }

    function syncView() {
      listBtn.setAttribute('aria-pressed', state.view === 'list' ? 'true' : 'false');
      gridBtn.setAttribute('aria-pressed', state.view === 'grid' ? 'true' : 'false');
    }

    function clearAll() {
      state = { q: '', category: 'all', program: 'all', language: 'all', status: 'all', repoType: 'all', sort: 'updated', view: state.view, page: 1, limit: state.limit };
      q.value = ''; syncControls(); sync();
    }

    function current() {
      var filtered = global.AtlasData.filterRepositories(all, state);
      var sorted = global.AtlasData.sortRepositories(filtered, state.sort);
      return { filtered: filtered, page: global.AtlasData.paginate(sorted, state.page, state.limit) };
    }

    function render() {
      results.innerHTML = skeletonHtml();
      global.setTimeout(function () {
        var c = current();
        state.page = c.page.pagination.page;
        var total = c.page.pagination.total, pages = c.page.pagination.pages;
        count.textContent = state.q || activeFilterCount() ? total + ' repositories matching your search' : total + ' repositories';
        renderActive();
        if (!total) {
          results.innerHTML = '<div class="empty"><h3>No repositories found.</h3><p>Try changing your search or removing some filters.</p><button class="btn btn-secondary" id="ax-empty-clear">Clear filters</button></div>';
          var b = results.querySelector('#ax-empty-clear'); if (b) b.addEventListener('click', clearAll);
          pager.innerHTML = ''; return;
        }
        if (state.view === 'grid') {
          results.innerHTML = '<div class="repo-grid">' + c.page.data.map(cardHtml).join('') + '</div>';
        } else {
          var isMobile = global.innerWidth < 720;
          var body = c.page.data.map(isMobile ? mobileRowHtml : rowHtml).join('');
          results.innerHTML = '<div class="repo-table-wrap"><table class="repo-table"><thead><tr><th scope="col">Project</th><th scope="col">Category</th><th scope="col">Program</th><th scope="col">Language</th><th scope="col">Stars</th><th scope="col">Updated</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead><tbody>' + body + '</tbody></table></div>';
        }
        bindOpen();
        renderPager(pages, total);
      }, 120);
    }

    function renderPager(pages, total) {
      var from = total === 0 ? 0 : (state.page - 1) * state.limit + 1;
      var to = Math.min(total, state.page * state.limit);
      var win = global.AtlasData.pageWindow(state.page, pages);
      var h = '<p class="info">Showing ' + from + '–' + to + ' of ' + total + ' · Page ' + state.page + ' of ' + pages + '</p>';
      h += '<button class="page-btn" data-pg="prev" ' + (state.page <= 1 ? 'disabled' : '') + ' aria-label="Previous page">← Previous</button>';
      win.forEach(function (n) {
        if (n === '…') h += '<span class="page-ellipsis" aria-hidden="true">…</span>';
        else h += '<button class="page-btn" data-pg="' + n + '"' + (n === state.page ? ' aria-current="page"' : '') + '>' + n + '</button>';
      });
      h += '<button class="page-btn" data-pg="next" ' + (state.page >= pages ? 'disabled' : '') + ' aria-label="Next page">Next →</button>';
      h += '<span class="per-page"><label for="ax-limit">Results per page</label><select id="ax-limit"><option>24</option><option>48</option><option>96</option></select></span>';
      pager.innerHTML = h;
      var lim = pager.querySelector('#ax-limit'); lim.value = String(state.limit);
      lim.addEventListener('change', function () { state.limit = parseInt(lim.value, 10); state.page = 1; sync(); });
      pager.querySelectorAll('[data-pg]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var v = btn.getAttribute('data-pg');
          if (v === 'prev') state.page = Math.max(1, state.page - 1);
          else if (v === 'next') state.page = Math.min(pages, state.page + 1);
          else state.page = parseInt(v, 10);
          sync();
          var top = host.querySelector('.results-bar');
          if (top && top.scrollIntoView) { try { top.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
        });
      });
    }

    function bindOpen() {
      results.querySelectorAll('[data-slug]').forEach(function (el) {
        function open() {
          var slug = el.getAttribute('data-slug');
          global.location.href = 'repository.html?slug=' + encodeURIComponent(slug);
        }
        el.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          open();
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });
    }

    function sync(replace) {
      writeParams(state, replace !== false);
      render();
    }

    q.addEventListener('input', function () {
      global.clearTimeout(debounce);
      debounce = global.setTimeout(function () { state.q = q.value.trim(); state.page = 1; sync(); }, DEBOUNCE_MS);
    });
    [program, category, language, status, repoType, sort].forEach(function (sel) {
      sel.addEventListener('change', function () {
        state.program = program.value; state.category = category.value; state.language = language.value;
        state.status = status.value; state.repoType = repoType.value; state.sort = sort.value;
        state.page = 1; sync();
      });
    });
    listBtn.addEventListener('click', function () { state.view = 'list'; syncView(); sync(); });
    gridBtn.addEventListener('click', function () { state.view = 'grid'; syncView(); sync(); });

    global.addEventListener('popstate', function () { state = readParams(); q.value = state.q; syncControls(); syncView(); render(); });
    global.addEventListener('resize', function () {
      global.clearTimeout(debounce);
      debounce = global.setTimeout(render, 200);
    });

    var fb = host.querySelector('#ax-filters-btn');
    if (fb) fb.addEventListener('click', function () {
      global.dispatchEvent(new CustomEvent('atlas:open-filters', { detail: state }));
    });

    render();
    return { getState: function () { return state; } };
  }

  global.AtlasExplorer = { mount: mount };
})(window);
