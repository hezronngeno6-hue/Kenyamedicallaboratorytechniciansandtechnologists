'use strict';

/* ---------------------------------------------------------------------------
   Client script for the KMLTT site.
   Vanilla JS, no build step. Each initialiser is a no-op unless the markup it
   targets exists, so this single file is safe to load on every page.
   --------------------------------------------------------------------------- */

(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[ch]);
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(String(value).length <= 10 ? value + 'T00:00:00Z' : value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    let body = null;
    try {
      body = await res.json();
    } catch (err) {
      body = null;
    }
    return { ok: res.ok, status: res.status, body: body };
  }

  function statusTone(status) {
    switch (String(status || '').toLowerCase()) {
      case 'active':
        return 'ok';
      case 'provisional':
        return 'info';
      case 'expired':
        return 'warn';
      case 'suspended':
        return 'error';
      default:
        return 'neutral';
    }
  }

  function badge(status) {
    return '<span class="badge badge--' + statusTone(status) + '">' + escapeHtml(status) + '</span>';
  }

  function alertBox(tone, title, message) {
    return (
      '<div class="alert alert--' + tone + '">' +
      '<div><p class="alert__title">' + escapeHtml(title) + '</p>' +
      '<p>' + escapeHtml(message) + '</p></div></div>'
    );
  }

  /* ----------------------------- Navigation ------------------------------ */

  function initNav() {
    const toggle = $('[data-nav-toggle]');
    const nav = $('[data-nav]');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      const open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }

  function initYear() {
    $$('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* --------------------------- Homepage stats ---------------------------- */

  function initStats() {
    const targets = $$('[data-stat]');
    if (!targets.length) return;

    fetchJson('/api/stats').then(function (res) {
      const data = (res.ok && res.body) || {};
      const map = {
        total: data.total,
        active: data.byStatus && data.byStatus.Active,
        cadres: data.cadres && data.cadres.length,
        counties: data.counties
      };

      targets.forEach(function (el) {
        const key = el.getAttribute('data-stat');
        const value = map[key];
        el.textContent = typeof value === 'number' ? value.toLocaleString() : '—';
      });

      const updated = $('[data-registry-updated]');
      if (updated && data.updatedAt) {
        updated.textContent = 'Registry last updated ' + formatDate(data.updatedAt);
      }
    });
  }

  /* ------------------------- Quick verify (hero) ------------------------- */

  function initQuickVerify() {
    const form = $('[data-quick-verify]');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const input = $('input[name="reg"]', form);
      const value = input ? input.value.trim() : '';
      if (!value) {
        if (input) input.focus();
        return;
      }
      window.location.href = '/verify?reg=' + encodeURIComponent(value);
    });
  }

  /* ----------------------------- Verify page ----------------------------- */

  function initVerify() {
    const form = $('[data-verify-form]');
    const output = $('[data-verify-output]');
    if (!form || !output) return;

    const input = $('input[name="reg"]', form);
    const button = $('button[type="submit"]', form);

    function setLoading(isLoading) {
      if (!button) return;
      button.disabled = isLoading;
      button.innerHTML = isLoading
        ? '<span class="spinner"></span>Checking…'
        : 'Verify registration';
    }

    function renderNotFound(query) {
      output.innerHTML =
        '<div class="result-card">' +
        '<div class="result-card__head result-card__head--error">' +
        '<h2>No record found</h2>' +
        '<span class="badge badge--error">Not in register</span>' +
        '</div>' +
        '<div class="result-card__body">' +
        alertBox(
          'error',
          'We could not match that number',
          'No registry entry matches "' + query + '". Check the number for typos, or contact the registry office if you believe this is an error.'
        ) +
        '</div></div>';
    }

    function renderResult(payload) {
      const m = payload.member || {};
      const active = String(m.status).toLowerCase() === 'active';

      const rows = [
        ['Registration number', '<span class="mono">' + escapeHtml(m.regNumber) + '</span>'],
        ['Cadre', escapeHtml(m.cadre)]
      ];

      if (m.designation) {
        rows.push(['Designation', '<strong>' + escapeHtml(m.designation) + '</strong>']);
      }

      rows.push(
        ['County', escapeHtml(m.county || '—')],
        ['Facility', escapeHtml(m.facility || '—')],
        ['Qualification', escapeHtml(m.qualification || '—')],
        ['First registered', escapeHtml(formatDate(m.registeredOn))],
        ['Current licence from', escapeHtml(formatDate(m.validFrom))],
        ['Current licence until', escapeHtml(formatDate(m.validUntil))],
        ['CPD points (cycle)', m.cpdPoints == null ? '—' : escapeHtml(m.cpdPoints)]
      );

      output.innerHTML =
        '<div class="result-card">' +
        '<div class="result-card__head' + (active ? ' result-card__head--ok' : '') + '">' +
        '<h2>' + escapeHtml(m.name) + '</h2>' +
        badge(m.status) +
        '</div>' +
        '<div class="result-card__body">' +
        '<dl class="detail-grid">' +
        rows
          .map(function (row) {
            return '<div><dt>' + escapeHtml(row[0]) + '</dt><dd>' + row[1] + '</dd></div>';
          })
          .join('') +
        '</dl>' +
        '<div class="ref-strip">' +
        '<span>Verification reference <strong class="mono">' + escapeHtml(payload.reference) + '</strong></span>' +
        '<span>Checked ' + escapeHtml(new Date(payload.checkedAt).toLocaleString()) + '</span>' +
        '</div>' +
        '</div></div>';
    }

    function lookup(value) {
      if (!value) {
        if (input) input.focus();
        return;
      }

      setLoading(true);
      output.innerHTML =
        '<div class="result-card"><div class="result-card__body">' +
        alertBox('info', 'Searching the register…', 'Looking up ' + value + '.') +
        '</div></div>';

      fetchJson('/api/verify?reg=' + encodeURIComponent(value))
        .then(function (res) {
          if (res.status === 404) return renderNotFound(value);
          if (!res.ok || !res.body) {
            output.innerHTML =
              '<div class="result-card"><div class="result-card__body">' +
              alertBox('error', 'Lookup failed', 'The registry service did not respond as expected. Please try again shortly.') +
              '</div></div>';
            return;
          }
          renderResult(res.body);
        })
        .catch(function () {
          output.innerHTML =
            '<div class="result-card"><div class="result-card__body">' +
            alertBox('error', 'Network error', 'Could not reach the registry service. Check your connection and try again.') +
            '</div></div>';
        })
        .then(function () {
          setLoading(false);
        });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      lookup(input ? input.value.trim() : '');
    });

    const fromUrl = new URLSearchParams(window.location.search).get('reg');
    if (fromUrl) {
      if (input) input.value = fromUrl;
      lookup(fromUrl);
    }
  }

  /* ---------------------------- Members page ----------------------------- */

  function initMembers() {
    const root = $('[data-members]');
    if (!root) return;

    const searchInput = $('[data-filter-search]', root);
    const cadreSelect = $('[data-filter-cadre]', root);
    const statusSelect = $('[data-filter-status]', root);
    const resultsEl = $('[data-members-results]', root);
    const countEl = $('[data-members-count]', root);
    const pagerEl = $('[data-members-pager]', root);

    const state = { q: '', cadre: '', status: '', page: 1, perPage: 12, total: 0, totalPages: 1 };
    let debounceTimer = null;

    function buildUrl() {
      const params = new URLSearchParams();
      if (state.q) params.set('q', state.q);
      if (state.cadre) params.set('cadre', state.cadre);
      if (state.status) params.set('status', state.status);
      params.set('page', String(state.page));
      params.set('perPage', String(state.perPage));
      return '/api/members?' + params.toString();
    }

    function loading() {
      resultsEl.innerHTML = '<div class="table-wrap"><div style="padding:24px">' +
        '<div class="skeleton" style="height:20px;margin-bottom:12px"></div>' +
        '<div class="skeleton" style="height:20px;margin-bottom:12px"></div>' +
        '<div class="skeleton" style="height:20px"></div>' +
        '</div></div>';
    }

    function renderRows(rows) {
      return (
        '<div class="table-wrap"><table>' +
        '<thead><tr>' +
        '<th>Practitioner</th><th>Registration</th><th>Cadre</th><th>Status</th><th>Valid until</th><th>County</th>' +
        '</tr></thead><tbody>' +
        rows
          .map(function (m) {
            return (
              '<tr>' +
              '<td><div class="cell-name">' + escapeHtml(m.name) + '</div>' +
              '<div class="cell-muted">' + escapeHtml(m.facility || '—') + '</div></td>' +
              '<td class="mono">' + escapeHtml(m.regNumber) + '</td>' +
              '<td>' + escapeHtml(m.cadre) + '</td>' +
              '<td>' + badge(m.status) + '</td>' +
              '<td>' + escapeHtml(formatDate(m.validUntil)) + '</td>' +
              '<td>' + escapeHtml(m.county || '—') + '</td>' +
              '</tr>'
            );
          })
          .join('') +
        '</tbody></table></div>'
      );
    }

    function renderPager() {
      if (state.totalPages <= 1) {
        pagerEl.innerHTML = '';
        return;
      }

      pagerEl.innerHTML =
        '<div class="pager__info">Page ' + state.page + ' of ' + state.totalPages + '</div>' +
        '<div class="pager__buttons">' +
        '<button class="btn btn--outline" data-page="' + (state.page - 1) + '"' +
        (state.page <= 1 ? ' disabled' : '') + '>Previous</button>' +
        '<button class="btn btn--outline" data-page="' + (state.page + 1) + '"' +
        (state.page >= state.totalPages ? ' disabled' : '') + '>Next</button>' +
        '</div>';

      $$('[data-page]', pagerEl).forEach(function (btn) {
        btn.addEventListener('click', function () {
          const next = Number(btn.getAttribute('data-page'));
          if (!next || next === state.page) return;
          state.page = next;
          load();
          root.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      });
    }

    function load() {
      loading();
      pagerEl.innerHTML = '';

      fetchJson(buildUrl())
        .then(function (res) {
          if (!res.ok || !res.body) {
            resultsEl.innerHTML = alertBox('error', 'Directory unavailable', 'The registry service did not respond as expected. Please try again shortly.');
            countEl.textContent = '';
            return;
          }

          state.total = res.body.total || 0;
          state.page = res.body.page || 1;
          state.totalPages = res.body.totalPages || 1;

          countEl.textContent =
            state.total === 0
              ? 'No matching records'
              : state.total.toLocaleString() + (state.total === 1 ? ' record' : ' records');

          resultsEl.innerHTML = state.total
            ? renderRows(res.body.results || [])
            : alertBox('info', 'Nothing matched your filters', 'Try a different name, registration number, cadre or status.');

          renderPager();
        })
        .catch(function () {
          resultsEl.innerHTML = alertBox('error', 'Network error', 'Could not reach the registry service. Check your connection and try again.');
        });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          state.q = searchInput.value.trim();
          state.page = 1;
          load();
        }, 260);
      });
    }

    if (cadreSelect) {
      cadreSelect.addEventListener('change', function () {
        state.cadre = cadreSelect.value;
        state.page = 1;
        load();
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', function () {
        state.status = statusSelect.value;
        state.page = 1;
        load();
      });
    }

    const initialQ = new URLSearchParams(window.location.search).get('q');
    if (initialQ && searchInput) {
      searchInput.value = initialQ;
      state.q = initialQ;
    }

    load();
  }

  function init() {
    initNav();
    initYear();
    initStats();
    initQuickVerify();
    initVerify();
    initMembers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
