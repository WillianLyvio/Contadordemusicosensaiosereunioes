(function () {
  'use strict';

  const STORAGE_KEY = 'contador-musicos-web-v1';

  const catalog = [
    {
      id: 'cordas',
      label: 'Cordas',
      items: [
        ['violinos', 'Violinos'],
        ['violas', 'Violas'],
        ['violoncelos', 'Violoncelos'],
      ],
    },
    {
      id: 'teclas',
      label: 'Teclas',
      items: [
        ['acordeons', 'Acordeons'],
        ['orgao', 'Órgão'],
      ],
    },
    {
      id: 'madeiras',
      label: 'Madeiras',
      items: [
        ['flautas', 'Flautas'],
        ['oboe', 'Oboé'],
        ['oboe_damore', 'Oboé d\'Amore'],
        ['corne_ingles', 'Corne Inglês'],
        ['fagote', 'Fagote'],
        ['clarinetes', 'Clarinetes'],
        ['clarone_alto', 'Clarone Alto'],
        ['clarones_baixos', 'Clarones Baixos'],
        ['saxofones_sopranos', 'Saxofones Sopranos'],
        ['saxofones_altos', 'Saxofones Altos'],
        ['saxofones_tenores', 'Saxofones Tenores'],
        ['saxofone_baritono', 'Saxofone Barítono'],
        ['saxofones_baixos', 'Saxofones Baixos'],
      ],
    },
    {
      id: 'metais',
      label: 'Metais',
      items: [
        ['cornet', 'Cornet'],
        ['trompetes', 'Trompetes'],
        ['flugelhorn', 'Flugelhorn'],
        ['trompa', 'Trompa'],
        ['trombones', 'Trombones'],
        ['trombonito', 'Trombonito'],
        ['baritono_de_pisto', 'Barítono de Pisto'],
        ['eufonios', 'Eufônios'],
        ['tubas', 'Tubas'],
      ],
    },
    {
      id: 'organistas',
      label: 'Organistas',
      items: [
        ['total_organistas', 'Total de Organistas'],
      ],
    },
    {
      id: 'ministerios',
      label: 'Ministérios e Colaboradores',
      items: [
        ['anciaes', 'Anciães'],
        ['diaconos', 'Diáconos'],
        ['cooperadores_oficiais', 'Cooperadores Oficiais'],
        ['cooperadores_jovens_menores', 'Cooperadores de Jovens e Menores'],
        ['irmaos_colaboradores', 'Irmãos Colaboradores'],
      ],
    },
    {
      id: 'parte_musical',
      label: 'Parte Musical',
      items: [
        ['encarregados_regionais', 'Encarregados Regionais'],
        ['examinadoras', 'Examinadoras'],
        ['encarregados_locais', 'Encarregados Locais'],
        ['instrutores', 'Instrutores(as)'],
        ['professores', 'Professores(as)'],
        ['irmaos_departamento_musical', 'Irmãos do Departamento Musical'],
      ],
    },
    {
      id: 'oficializacao',
      label: 'Oficialização',
      items: [
        ['musico', 'Músico'],
        ['organista', 'Organista'],
      ],
    },
  ];

  const chartGroups = ['cordas', 'teclas', 'madeiras', 'metais'];
  const chartColors = ['#3f3f46', '#737373', '#a3a3a3', '#d4d4d4'];

  let state = loadState();

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindTabs();
    bindActions();
    bindInputs();
    render();
    registerServiceWorker();
  }

  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeTab = button.dataset.tab;
        saveState();
        render();
      });
    });
  }

  function bindActions() {
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'save') {
          saveState();
          showToast('Dados salvos neste aparelho.');
        }
        if (action === 'print') {
          state.activeTab = 'report';
          saveState();
          render();
          window.setTimeout(() => window.print(), 80);
        }
        if (action === 'export') exportDeviceCounts();
        if (action === 'export-final') exportFinalReport();
        if (action === 'clear-imports') {
          state.imports = {};
          saveState();
          render();
          showToast('Importações removidas.');
        }
      });
    });

    document.getElementById('importFiles').addEventListener('change', importFiles);
  }

  function bindInputs() {
    const bindings = [
      ['eventName', 'name'],
      ['eventDate', 'date'],
      ['eventLocal', 'local'],
      ['eventRegion', 'region'],
      ['deviceName', 'deviceName'],
    ];

    bindings.forEach(([elementId, field]) => {
      const element = document.getElementById(elementId);
      element.addEventListener('input', () => {
        if (field === 'deviceName') {
          state.deviceName = element.value;
        } else {
          state.event[field] = element.value;
        }
        saveState();
        renderReport();
      });
    });
  }

  function loadState() {
    const fallback = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw);
      return normalizeState({...fallback, ...parsed});
    } catch (error) {
      return fallback;
    }
  }

  function defaultState() {
    return {
      schemaVersion: 1,
      deviceId: createId('device'),
      deviceName: 'Aparelho principal',
      activeTab: 'event',
      selectedGroup: 'cordas',
      event: {
        name: 'Contagem de Músicos e Organistas',
        date: today(),
        local: '',
        region: '',
      },
      counts: emptyCounts(),
      imports: {},
    };
  }

  function normalizeState(raw) {
    return {
      ...raw,
      event: {
        ...defaultState().event,
        ...(raw.event || {}),
      },
      counts: normalizeCounts(raw.counts || {}),
      imports: raw.imports && typeof raw.imports === 'object' ? raw.imports : {},
      selectedGroup: catalog.some((group) => group.id === raw.selectedGroup)
        ? raw.selectedGroup
        : 'cordas',
      activeTab: ['event', 'count', 'sync', 'report'].includes(raw.activeTab)
        ? raw.activeTab
        : 'event',
    };
  }

  function emptyCounts() {
    return Object.fromEntries(
      catalog.map((group) => [
        group.id,
        Object.fromEntries(group.items.map(([itemId]) => [itemId, 0])),
      ]),
    );
  }

  function normalizeCounts(counts) {
    const normalized = emptyCounts();
    catalog.forEach((group) => {
      group.items.forEach(([itemId]) => {
        normalized[group.id][itemId] = safeNumber(counts?.[group.id]?.[itemId]);
      });
    });
    return normalized;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    renderTabs();
    renderInputs();
    renderGroups();
    renderCounters();
    renderSummary();
    renderImports();
    renderReport();
  }

  function renderTabs() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tab === state.activeTab);
    });
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.toggle('is-active', view.id === `view-${state.activeTab}`);
    });
  }

  function renderInputs() {
    setInputValue('eventName', state.event.name);
    setInputValue('eventDate', state.event.date);
    setInputValue('eventLocal', state.event.local);
    setInputValue('eventRegion', state.event.region);
    setInputValue('deviceName', state.deviceName);
  }

  function setInputValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (document.activeElement !== element) {
      element.value = value || '';
    }
  }

  function renderGroups() {
    const groupStrip = document.getElementById('groupStrip');
    groupStrip.innerHTML = catalog.map((group) => {
      const subtotal = groupSubtotal(state.counts, group.id);
      return `
        <button class="group-button ${group.id === state.selectedGroup ? 'is-active' : ''}" type="button" data-group="${group.id}">
          <strong>${escapeHtml(group.label)}</strong>
          <span>Neste aparelho: ${subtotal}</span>
        </button>
      `;
    }).join('');

    groupStrip.querySelectorAll('[data-group]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedGroup = button.dataset.group;
        saveState();
        render();
      });
    });
  }

  function renderCounters() {
    const group = catalog.find((item) => item.id === state.selectedGroup) || catalog[0];
    const list = document.getElementById('counterList');
    list.innerHTML = group.items.map(([itemId, label]) => {
      const value = state.counts[group.id][itemId] || 0;
      return `
        <div class="counter-row">
          <div class="counter-label">${escapeHtml(label)}</div>
          <button class="counter-button" type="button" data-delta="-1" data-group="${group.id}" data-item="${itemId}">-</button>
          <div class="counter-value">${value}</div>
          <button class="counter-button plus" type="button" data-delta="1" data-group="${group.id}" data-item="${itemId}">+</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-delta]').forEach((button) => {
      button.addEventListener('click', () => {
        const groupId = button.dataset.group;
        const itemId = button.dataset.item;
        const delta = Number(button.dataset.delta);
        state.counts[groupId][itemId] = Math.max(
          0,
          safeNumber(state.counts[groupId][itemId]) + delta,
        );
        saveState();
        render();
      });
    });
  }

  function renderSummary() {
    const merged = mergedCounts();
    const localTotals = calculateTotals(state.counts);
    const mergedTotals = calculateTotals(merged);
    const selectedSubtotal = groupSubtotal(state.counts, state.selectedGroup);
    const importedDevices = Object.keys(state.imports).length;

    document.getElementById('summaryStrip').innerHTML = [
      ['Grupo neste aparelho', selectedSubtotal],
      ['Total neste aparelho', localTotals.totalGeralPresentes],
      ['Celulares importados', importedDevices],
      ['Total consolidado', mergedTotals.totalGeralPresentes],
    ].map(([label, value]) => `
      <div class="summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${value}</strong>
      </div>
    `).join('');
  }

  function renderImports() {
    const imports = Object.values(state.imports)
      .sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)));
    const list = document.getElementById('importList');

    if (imports.length === 0) {
      list.innerHTML = '<p class="muted">Nenhum celular importado ainda.</p>';
      return;
    }

    list.innerHTML = imports.map((packet) => {
      const totals = calculateTotals(normalizeCounts(packet.counts));
      return `
        <div class="import-item">
          <strong>${escapeHtml(packet.deviceName || 'Aparelho sem nome')}</strong>
          <span>Data: ${formatDate(packet.event?.date)} | Total importado: ${totals.totalGeralPresentes}</span>
          <span>Recebido de ${escapeHtml(packet.deviceId || '')} em ${formatDateTime(packet.exportedAt)}</span>
        </div>
      `;
    }).join('');
  }

  function renderReport() {
    const merged = mergedCounts();
    const totals = calculateTotals(merged);
    const subtitleParts = [
      state.event.name,
      formatDate(state.event.date),
      state.event.local,
      state.event.region,
    ].filter(Boolean);

    document.getElementById('reportSubtitle').textContent = subtitleParts.join(' | ');
    document.getElementById('reportMeta').innerHTML = [
      ['Evento', state.event.name],
      ['Data', formatDate(state.event.date)],
      ['Local', state.event.local || '-'],
      ['Região', state.event.region || '-'],
      ['Aparelhos importados', String(Object.keys(state.imports).length)],
    ].map(([label, value]) => `
      <div class="meta-line"><strong>${escapeHtml(label)}:</strong><span>${escapeHtml(value)}</span></div>
    `).join('');

    document.getElementById('totalsGrid').innerHTML = [
      ['Total de músicos', totals.totalMusicos],
      ['Total de organistas', totals.totalOrganistas],
      ['Músicos + organistas', totals.totalMusicosOrganistas],
      ['Ministério e colaboradores', totals.totalMinisterioColaboradores],
      ['Oficialização', totals.totalOficializacao],
      ['Total geral de presentes', totals.totalGeralPresentes],
    ].map(([label, value]) => `
      <div class="total-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
    `).join('');

    renderChart(merged);
    renderTables(merged);
  }

  function renderChart(counts) {
    const total = chartGroups.reduce((sum, groupId) => sum + groupSubtotal(counts, groupId), 0);
    let current = 0;
    const stops = chartGroups.map((groupId, index) => {
      const value = groupSubtotal(counts, groupId);
      const start = current;
      current += total === 0 ? 0 : (value / total) * 360;
      return `${chartColors[index]} ${start}deg ${current}deg`;
    });

    document.getElementById('pieChart').style.background = total === 0
      ? 'conic-gradient(#e5e5e5 0deg 360deg)'
      : `conic-gradient(${stops.join(', ')})`;

    document.getElementById('chartLegend').innerHTML = chartGroups.map((groupId, index) => {
      const group = catalog.find((item) => item.id === groupId);
      const value = groupSubtotal(counts, groupId);
      const percent = total === 0 ? '0.0' : ((value / total) * 100).toFixed(1);
      return `
        <div class="legend-row">
          <span class="legend-dot" style="background:${chartColors[index]}"></span>
          <span>${escapeHtml(group.label)}</span>
          <span>${value} (${percent}%)</span>
        </div>
      `;
    }).join('');
  }

  function renderTables(counts) {
    document.getElementById('tableGrid').innerHTML = catalog.map((group) => {
      const rows = group.items.map(([itemId, label]) => `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td>${safeNumber(counts[group.id]?.[itemId])}</td>
        </tr>
      `).join('');

      return `
        <table class="report-table">
          <caption>${escapeHtml(group.label)}</caption>
          <thead>
            <tr><th>Item</th><th>Qtd.</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="subtotal-row"><td>Subtotal</td><td>${groupSubtotal(counts, group.id)}</td></tr>
          </tbody>
        </table>
      `;
    }).join('');
  }

  function exportDeviceCounts() {
    const packet = buildPacket('device-counts', state.counts);
    downloadJson(fileName('contagem', state.deviceName), packet);
    showToast('Arquivo de contagem gerado.');
  }

  function exportFinalReport() {
    const packet = {
      ...buildPacket('final-report', mergedCounts()),
      totals: calculateTotals(mergedCounts()),
      imports: Object.values(state.imports).map((item) => ({
        deviceId: item.deviceId,
        deviceName: item.deviceName,
        exportedAt: item.exportedAt,
      })),
    };
    downloadJson(fileName('relatorio-final', state.event.name), packet);
    showToast('Arquivo do relatório final gerado.');
  }

  async function importFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    let imported = 0;
    let skipped = 0;
    for (const file of files) {
      try {
        const packet = JSON.parse(await file.text());
        if (!isValidPacket(packet)) {
          skipped++;
          continue;
        }
        if (packet.event.date !== state.event.date) {
          skipped++;
          continue;
        }
        if (packet.deviceId === state.deviceId) {
          skipped++;
          continue;
        }

        const key = `${packet.event.date}:${packet.deviceId}`;
        const previous = state.imports[key];
        if (!previous || String(packet.exportedAt) >= String(previous.exportedAt)) {
          state.imports[key] = {
            ...packet,
            counts: normalizeCounts(packet.counts),
          };
          imported++;
        } else {
          skipped++;
        }
      } catch (error) {
        skipped++;
      }
    }

    event.target.value = '';
    saveState();
    render();
    showToast(`${imported} arquivo(s) importado(s). ${skipped} ignorado(s).`);
  }

  function buildPacket(kind, counts) {
    return {
      schemaVersion: 1,
      kind,
      generatedBy: 'contador-musicos-web',
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      exportedAt: new Date().toISOString(),
      event: {...state.event},
      counts: normalizeCounts(counts),
    };
  }

  function isValidPacket(packet) {
    return packet
      && packet.schemaVersion === 1
      && ['device-counts', 'final-report'].includes(packet.kind)
      && packet.deviceId
      && packet.event
      && packet.event.date
      && packet.counts;
  }

  function mergedCounts() {
    const merged = normalizeCounts(state.counts);
    Object.values(state.imports).forEach((packet) => {
      if (packet?.event?.date !== state.event.date) return;
      const importedCounts = normalizeCounts(packet.counts);
      catalog.forEach((group) => {
        group.items.forEach(([itemId]) => {
          merged[group.id][itemId] += safeNumber(importedCounts[group.id][itemId]);
        });
      });
    });
    return merged;
  }

  function groupSubtotal(counts, groupId) {
    const group = catalog.find((item) => item.id === groupId);
    if (!group) return 0;
    return group.items.reduce((sum, [itemId]) => sum + safeNumber(counts?.[groupId]?.[itemId]), 0);
  }

  function calculateTotals(counts) {
    const totalMusicos = ['cordas', 'teclas', 'madeiras', 'metais']
      .reduce((sum, groupId) => sum + groupSubtotal(counts, groupId), 0);
    const totalOrganistas = groupSubtotal(counts, 'organistas');
    const totalMinisterioColaboradores =
      groupSubtotal(counts, 'ministerios') + groupSubtotal(counts, 'parte_musical');
    const totalOficializacao = groupSubtotal(counts, 'oficializacao');

    return {
      totalMusicos,
      totalOrganistas,
      totalMusicosOrganistas: totalMusicos + totalOrganistas,
      totalMinisterioColaboradores,
      totalOficializacao,
      totalGeralPresentes: totalMusicos + totalOrganistas + totalMinisterioColaboradores,
    };
  }

  function downloadJson(name, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function fileName(prefix, label) {
    const slug = String(label || 'sem-nome')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${prefix}-${state.event.date}-${slug || 'contagem'}`;
  }

  function safeNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.floor(number));
  }

  function today() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function createId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    const [year, month, day] = String(value).split('-');
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch (error) {
      return String(value);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // Offline cache is optional; the app still works without it.
    });
  }
}());
