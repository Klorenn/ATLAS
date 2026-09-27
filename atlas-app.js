// ATLAS landing logic: counters, reveal, mobile menu, command palette (Cmd+K), filter drawer.

(function initAtlasApp(global) {
  'use strict';

  function animateCounters() {
    var els = document.querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in global)) {
      els.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var start = null;
        function step(t) {
          if (!start) start = t;
          var p = Math.min(1, (t - start) / 1200);
          var v = target * (0.2 + 0.8 * (1 - Math.pow(1 - p, 3)));
          el.textContent = (target >= 100 ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 10) / 10)) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = (target >= 100 ? Math.round(target).toLocaleString('en-US') : target) + suffix;
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  function reveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in global)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  function mobileMenu() {
    var burger = document.getElementById('nav-burger');
    var menu = document.getElementById('mobile-menu');
    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
      var open = menu.hidden;
      menu.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); });
    });
  }

  function heroStats(catalog) {
    if (!catalog || !catalog.summary) return;
    var s = catalog.summary;
    setStat('stat-repos', s.repositories);
    setStat('stat-programs', 15);
    function setStat(id, v) {
      var el = document.getElementById(id);
      if (el && v != null) { el.setAttribute('data-count', String(v)); el.textContent = String(v); }
    }
  }

  // Command palette: Cmd/Ctrl+K. Busca proyectos, repos, programas, organizaciones.
  function commandPalette() {
    var backdrop = document.getElementById('cmd-backdrop');
    var input = document.getElementById('cmd-input');
    var list = document.getElementById('cmd-list');
    if (!backdrop || !input || !list) return;
    var catalog = global.tellusCatalog;
    var selected = 0, items = [];

    function open() { backdrop.hidden = false; input.value = ''; render(''); input.focus(); }
    function close() { backdrop.hidden = true; }
    function render(qq) {
      items = [];
      var q = (qq || '').toLowerCase().trim();
      if (catalog) {
        (catalog.projects || []).slice(0, 400).forEach(function (p) {
          if (!q || (p.name + ' ' + (p.description || '')).toLowerCase().indexOf(q) !== -1) {
            items.push({ kind: 'Project', label: p.name, sub: (p.types || []).slice(0, 2).join(' · '), href: 'repository.html?slug=' + encodeURIComponent((p.repositories && p.repositories[0] && p.repositories[0].url.split('/').slice(-2).join('/').toLowerCase().replace(/[^a-z0-9]+/g, '-')) || p.slug) });
          }
        });
        (catalog.repositories || []).slice(0, 400).forEach(function (r) {
          if (!q || r.fullName.toLowerCase().indexOf(q) !== -1) {
            items.push({ kind: 'Repository', label: r.fullName, sub: (r.language || '') + (r.stars != null ? ' · ' + r.stars + ' ★' : ''), href: 'repository.html?slug=' + encodeURIComponent(String(r.fullName).toLowerCase().replace(/[^a-z0-9]+/g, '-')) });
          }
        });
      }
      [{ kind: 'Program', label: 'Stellar Community Fund', href: 'program.html?slug=scf' },
       { kind: 'Program', label: 'InstaWards', href: 'program.html?slug=instawards' },
       { kind: 'Program', label: 'SDF Ecosystem Programs', href: 'program.html?slug=sdf' },
       { kind: 'Program', label: 'Hackathons', href: 'program.html?slug=hackathon' }
      ].forEach(function (p) { if (!q || p.label.toLowerCase().indexOf(q) !== -1) items.push(p); });
      items = items.slice(0, 9);
      selected = 0;
      list.innerHTML = items.map(function (it, i) {
        return '<div class="cmd-item" role="option" aria-selected="' + (i === selected) + '" data-i="' + i + '"><span>' + escapeHtml(it.label) + '</span><span class="kind">' + escapeHtml(it.kind) + '</span></div>';
      }).join('') || '<div class="cmd-item"><span>No results</span><span class="kind">—</span></div>';
      list.querySelectorAll('.cmd-item[data-i]').forEach(function (el) {
        el.addEventListener('click', function () { go(parseInt(el.getAttribute('data-i'), 10)); });
      });
    }
    function go(i) { var it = items[i]; if (it) global.location.href = it.href; }
    function escapeHtml(s) { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }

    global.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); backdrop.hidden ? open() : close(); }
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        var ex = document.getElementById('ax-q'); if (ex) { e.preventDefault(); ex.focus(); }
      }
      if (!backdrop.hidden && e.key === 'Escape') close();
      if (!backdrop.hidden && e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(items.length - 1, selected + 1); paint(); }
      if (!backdrop.hidden && e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(0, selected - 1); paint(); }
      if (!backdrop.hidden && e.key === 'Enter') go(selected);
    });
    function paint() {
      list.querySelectorAll('.cmd-item').forEach(function (el, i) { el.setAttribute('aria-selected', String(i === selected)); });
    }
    input.addEventListener('input', function () { render(input.value); });
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
  }

  function filterDrawer() {
    var backdrop = document.getElementById('drawer-backdrop');
    var drawer = document.getElementById('filter-drawer');
    if (!backdrop || !drawer) return;
    function close() { backdrop.hidden = true; drawer.hidden = true; }
    global.addEventListener('atlas:open-filters', function () {
      var selects = document.querySelectorAll('.filter-row select');
      var body = '<h3>Filters</h3>';
      selects.forEach(function (s, i) {
        body += '<div style="margin-bottom:12px"><label style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">' + s.getAttribute('aria-label') + '</label><br>' +
          '<select data-mirror="' + i + '" style="width:100%;margin-top:6px;border:1px solid var(--line);border-radius:6px;padding:10px">' + s.innerHTML + '</select></div>';
      });
      body += '<button class="btn" id="drawer-apply" style="width:100%;justify-content:center">Show results</button>';
      drawer.innerHTML = body;
      drawer.querySelectorAll('[data-mirror]').forEach(function (m) {
        var src = selects[parseInt(m.getAttribute('data-mirror'), 10)];
        m.value = src.value;
        m.addEventListener('change', function () { src.value = m.value; src.dispatchEvent(new Event('change')); });
      });
      backdrop.hidden = false; drawer.hidden = false;
      drawer.querySelector('#drawer-apply').addEventListener('click', close);
    });
    backdrop.addEventListener('click', close);
  }

  function init() {
    animateCounters(); reveal(); mobileMenu(); commandPalette(); filterDrawer();
    heroStats(global.tellusCatalog);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
