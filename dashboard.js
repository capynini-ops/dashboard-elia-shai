/* ============================================================
   DASHBOARD RSVP — dashboard.js
   ============================================================ */

(function () {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzSFCRChzA9hsJ6mzmgz1RCRNmJ2iRhQ-di8q-2MBCwbPh_Rx8Jq0TfFFdWkB5LmF6w/exec';

  // ── STATE ────────────────────────────────────────────────
  let allData = [];
  let filteredData = [];
  let activeFilters = { level: 'all', event: 'all' };
  let sortState = { col: 'date', dir: 'desc' };
  let searchQuery = '';

  // ── DOM REFS ─────────────────────────────────────────────
  const stateLoading  = document.getElementById('stateLoading');
  const stateError    = document.getElementById('stateError');
  const mainContent   = document.getElementById('mainContent');
  const errorMsg      = document.getElementById('errorMsg');
  const tableBody     = document.getElementById('tableBody');
  const emptyState    = document.getElementById('emptyState');
  const resultsCount  = document.getElementById('resultsCount');
  const lastUpdate    = document.getElementById('lastUpdate');
  const searchInput   = document.getElementById('searchInput');
  const btnRefresh    = document.getElementById('btnRefresh');
  const refreshIcon   = document.getElementById('refreshIcon');
  const rsvpTable     = document.getElementById('rsvpTable');

  // ── LOAD DATA ────────────────────────────────────────────
  async function loadData() {
    showState('loading');
    refreshIcon.classList.add('spinning');
    btnRefresh.disabled = true;

    try {
      const res = await fetch(SCRIPT_URL + '?t=' + Date.now());
      const json = await res.json();

      if (json.status !== 'success' || !Array.isArray(json.data)) {
        throw new Error(json.message || 'Réponse inattendue du serveur.');
      }

      allData = json.data;
      updateStats();
      applyFilters();
      showState('content');

      const now = new Date();
      lastUpdate.textContent = 'Mis à jour à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    } catch (err) {
      errorMsg.textContent = 'Erreur : ' + err.message;
      showState('error');
    } finally {
      refreshIcon.classList.remove('spinning');
      btnRefresh.disabled = false;
    }
  }

  function showState(state) {
    stateLoading.classList.toggle('d-none', state !== 'loading');
    stateError.classList.toggle('d-none', state !== 'error');
    mainContent.classList.toggle('d-none', state !== 'content');
  }

  // ── STATS ─────────────────────────────────────────────────
  function updateStats() {
    const total = allData.length;

    let nbMairie = 0, absMairie = 0;
    let nbCocktail = 0, absCocktail = 0;
    let nbChabat = 0, absChabat = 0;

    allData.forEach(row => {
      // Mairie
      if (row.presenceMairie === 'Oui') {
        nbMairie += parseInt(row.nbMairie) || 1;
      } else if (row.presenceMairie === 'Non') {
        absMairie++;
      }
      // Cocktail
      if (row.presenceCocktail === 'Oui') {
        nbCocktail += parseInt(row.nbCocktail) || 1;
      } else if (row.presenceCocktail === 'Non') {
        absCocktail++;
      }
      // Chabat
      if (row.presenceChabat === 'Oui') {
        nbChabat += parseInt(row.nbChabat) || 1;
      } else if (row.presenceChabat === 'Non') {
        absChabat++;
      }
    });

    document.getElementById('statTotal').textContent    = total;
    document.getElementById('statMairie').textContent   = nbMairie;
    document.getElementById('statCocktail').textContent = nbCocktail;
    document.getElementById('statChabat').textContent   = nbChabat;

    const mairieInvited = allData.filter(r => r.presenceMairie !== 'Non invité').length;
    const chabatInvited = allData.filter(r => r.presenceChabat !== 'Non invité').length;


  }

  // ── FILTERS ──────────────────────────────────────────────
  function applyFilters() {
    let data = [...allData];
    const q = searchQuery.toLowerCase().trim();

    // Recherche texte
    if (q) {
      data = data.filter(r =>
        (r.nom || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.telephone || '').toLowerCase().includes(q) ||
        (r.message || '').toLowerCase().includes(q)
      );
    }

    // Filtre niveau
    if (activeFilters.level !== 'all') {
      data = data.filter(r => (r.inviteLevel || '').toLowerCase() === activeFilters.level);
    }

    // Filtre événement (présent à cet événement)
    if (activeFilters.event !== 'all') {
      const map = { mairie: 'presenceMairie', cocktail: 'presenceCocktail', chabat: 'presenceChabat' };
      const field = map[activeFilters.event];
      data = data.filter(r => r[field] === 'Oui');
    }

    // Tri
    data = sortData(data, sortState.col, sortState.dir);

    filteredData = data;
    renderTable();
    resultsCount.textContent = data.length + ' résultat' + (data.length !== 1 ? 's' : '');
  }

  function sortData(data, col, dir) {
    return data.slice().sort((a, b) => {
      let va = a[col] || '', vb = b[col] || '';
      // Tri date : parser la date française dd/mm/yyyy hh:mm:ss
      if (col === 'date') {
        va = parseFrDate(va);
        vb = parseFrDate(vb);
      } else {
        va = va.toString().toLowerCase();
        vb = vb.toString().toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function parseFrDate(str) {
    // "28/04/2025, 14:32:10" → timestamp
    if (!str) return 0;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
    if (m) return new Date(m[3], m[2] - 1, m[1], m[4], m[5]).getTime();
    return new Date(str).getTime() || 0;
  }

  // ── RENDER TABLE ─────────────────────────────────────────
  function renderTable() {
    tableBody.innerHTML = '';

    if (filteredData.length === 0) {
      emptyState.classList.remove('d-none');
      rsvpTable.querySelector('thead').style.display = 'none';
      return;
    }

    emptyState.classList.add('d-none');
    rsvpTable.querySelector('thead').style.display = '';

    filteredData.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-nom">${esc(row.nom)}</td>
        <td>${badgeLevel(row.inviteLevel)}</td>
        <td class="td-event">${eventCell(row.presenceMairie, row.nbMairie)}</td>
        <td class="td-event">${eventCell(row.presenceCocktail, row.nbCocktail)}</td>
        <td class="td-event">${eventCell(row.presenceChabat, row.nbChabat)}</td>
        <td class="td-msg">${msgCell(row.message)}</td>
      `;
      tableBody.appendChild(tr);
    });

    // Bootstrap tooltips sur les messages
    tableBody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      new bootstrap.Tooltip(el, { placement: 'left', customClass: 'tooltip-msg' });
    });
  }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDate(str) {
    if (!str) return '—';
    // Affiche seulement dd/mm/yyyy hh:mm
    const m = str.match(/(\d{2}\/\d{2}\/\d{4})[,\s]+(\d{2}:\d{2})/);
    if (m) return `<span>${m[1]}</span><br><span style="font-size:10px">${m[2]}</span>`;
    return str;
  }

  function badgeLevel(level) {
    const labels = { latotale: 'La Totale', classico: 'Classico', labase: 'La Base' };
    const cls    = { latotale: 'badge-latotale', classico: 'badge-classico', labase: 'badge-labase' };
    const l = (level || 'labase').toLowerCase();
    return `<span class="badge-level ${cls[l] || 'badge-labase'}">${labels[l] || esc(level)}</span>`;
  }

  function eventCell(presence, nb) {
    if (!presence || presence === '') return `<span class="presence-uninvited">—</span>`;
    if (presence === 'Non invité') return `<span class="presence-uninvited">N/A</span>`;
    if (presence === 'Oui') {
      const n = parseInt(nb) || 1;
      return `<span class="presence-yes"><i class="bi bi-check-lg"></i><span class="nb-persons">${n}</span></span>`;
    }
    if (presence === 'Non') return `<span class="presence-no"><i class="bi bi-x"></i> Non</span>`;
    return `<span class="presence-uninvited">${esc(presence)}</span>`;
  }

  function msgCell(msg) {
    if (!msg || msg.trim() === '') return '<span style="color:var(--border)">—</span>';
    const safe = esc(msg);
    if (msg.length > 50) {
      return `<span class="msg-truncate" data-bs-toggle="tooltip" data-bs-title="${safe}">${safe}</span>`;
    }
    return `<span>${safe}</span>`;
  }

  // ── EVENTS ───────────────────────────────────────────────
  btnRefresh.addEventListener('click', loadData);

  searchInput.addEventListener('input', function () {
    searchQuery = this.value;
    applyFilters();
  });

  // Filtres boutons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const group = this.dataset.filter;
      const value = this.dataset.value;

      // Désactiver les autres du même groupe
      document.querySelectorAll(`.filter-btn[data-filter="${group}"]`).forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      activeFilters[group] = value;
      applyFilters();
    });
  });

  // Tri par colonnes
  document.querySelectorAll('.rsvp-table th.sortable').forEach(th => {
    th.addEventListener('click', function () {
      const col = this.dataset.col;
      if (sortState.col === col) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.col = col;
        sortState.dir = 'asc';
      }
      // Reset all sort classes
      document.querySelectorAll('.rsvp-table th.sortable').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      this.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
      applyFilters();
    });
  });

  // ── INIT ─────────────────────────────────────────────────
  window.loadData = loadData;
  loadData();

})();
