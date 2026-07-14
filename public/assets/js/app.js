(function () {
  'use strict';

  const STORAGE_KEY = 'contador-musicos-web-v1';
  const AUTH_SESSION_KEY = 'contador-musicos-auth-v1';
  const ACCESS_LOG_KEY = 'contador-musicos-access-logs-v1';
  const USER_STORAGE_KEY = 'contador-musicos-users-v1';
  const AUTH_API_URL = 'api/auth.php';
  const USER_API_URL = 'api/users.php';
  const SYNC_API_URL = 'api/sync.php';
  const ASSIGNMENTS_API_URL = 'api/assignments.php';
  const EVENTS_API_URL = 'api/events.php';
  const FALLBACK_USER_ACCOUNTS = [
    {
      username: 'admin',
      password: 'admin123',
      name: 'Administrador',
      role: 'administrador',
    },
    {
      username: 'contador',
      password: 'contador123',
      name: 'Contador',
      role: 'contador',
    },
  ];
  let projectUserAccounts = [];
  let adminFilePassword = '';
  let syncTimer = null;
  let syncInProgress = false;
  let availableEvents = [];
  let historyEvents = [];
  let agendaEvents = [];
  let editingEventKey = '';

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
  const eventTypes = [
    'Reunião de encarregados e instrutores',
    'Ensaio Regional',
    'Exames musicais',
  ];
  const instrumentGroupIds = ['cordas', 'teclas', 'madeiras', 'metais'];
  const assignableGroupIds = [
    'cordas',
    'teclas',
    'madeiras',
    'metais',
    'organistas',
    'ministerios',
    'parte_musical',
    'oficializacao',
  ];

  let state = loadState();
  let currentUser = loadSession();

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await restoreServerSession();
    if (isAdmin()) await refreshProjectUserAccounts();
    bindAuth();
    bindTabs();
    bindActions();
    bindInputs();
    bindUserManagement();
    bindEventSelection();
    renderAuth();
    if (currentUser) {
      render();
      await loadAvailableEvents();
      if (state.selectedEventKey) await loadRemoteCounts(false);
    }
    registerServiceWorker();
    window.setInterval(() => {
      if (currentUser && state.selectedEventKey) loadRemoteCounts(true);
    }, 10000);
  }

  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.tab === 'admin' && !isAdmin()) {
          writeAccessLog('access_denied', 'Tentativa de abrir administração');
          showToast('Acesso permitido apenas para administrador.');
          return;
        }
        if (button.dataset.tab === 'event' && !isManager()) {
          showToast('Somente Administrador ou Supervisor pode criar eventos.');
          return;
        }
        if (['count', 'sync', 'report'].includes(button.dataset.tab) && !state.selectedEventKey) {
          showToast('Selecione um evento antes de iniciar a contagem.');
          state.activeTab = 'select-event';
          render();
          return;
        }
        if (button.dataset.tab === 'report' && !isEventFinalized()) {
          showToast('O relatório será liberado após o Administrador encerrar a contagem.');
          return;
        }
        state.activeTab = button.dataset.tab;
        saveState();
        writeAccessLog('open_tab', button.dataset.tab);
        render();
      });
    });
  }

  function bindAuth() {
    document.getElementById('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = normalizeUsername(document.getElementById('loginUser').value);
      const password = document.getElementById('loginPassword').value;
      const response = await apiRequest(AUTH_API_URL, {
        method: 'POST',
        body: JSON.stringify({username, password}),
      }).catch((error) => ({ok: false, message: error.message}));

      if (!response.ok || !response.user) {
        document.getElementById('loginError').textContent = response.message || 'Usuário ou senha inválidos.';
        writeAccessLog('login_failed', username || 'sem usuario');
        return;
      }

      currentUser = {...response.user, countGroups: [], loginAt: new Date().toISOString()};
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
      state.activeTab = 'select-event';
      state.selectedEventKey = '';
      saveState();
      document.getElementById('loginError').textContent = '';
      writeAccessLog('login_success', currentUser.countGroups.length > 0
        ? `Entrada no sistema | Grupos: ${groupLabels(currentUser.countGroups)}`
        : 'Entrada no sistema');
      renderAuth();
      render();
      if (isAdmin()) await refreshProjectUserAccounts();
      await loadAvailableEvents();
    });
  }

  function selectedLoginCountGroups() {
    return Array.from(document.querySelectorAll('[name="selectionCountGroups"]:checked'))
      .map((input) => input.value)
      .filter((groupId) => assignableGroupIds.includes(groupId));
  }

  function renderLoginGroupRequirement() {
    return null;
  }

  function bindActions() {
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        if (action === 'save') {
          saveState();
          writeAccessLog('save', 'Dados salvos');
          showToast('Dados salvos neste aparelho.');
        }
        if (action === 'print') {
          if (!isEventFinalized()) {
            showToast('O relatório será liberado após o encerramento da contagem.');
            return;
          }
          await loadRemoteCounts(false);
          state.activeTab = 'report';
          saveState();
          writeAccessLog('print_report', 'Relatório enviado para impressão/PDF');
          render();
          window.setTimeout(() => window.print(), 80);
        }
        if (action === 'sync-now') synchronizeCounts(true);
        if (action === 'finalize-event') finalizeEvent();
        if (action === 'logout') logout();
        if (action === 'export-logs') exportAccessLogs();
        if (action === 'clear-logs') clearAccessLogs();
      });
    });

  }

  function bindUserManagement() {
    document.getElementById('userForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await saveUserFromForm();
    });

    document.getElementById('cancelUserEdit').addEventListener('click', resetUserForm);

    document.getElementById('userTableBody').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-user-action]');
      if (!button) return;

      const username = button.dataset.username;
      if (button.dataset.userAction === 'edit') editUser(username);
      if (button.dataset.userAction === 'reset-password') await resetUserPassword(username);
      if (button.dataset.userAction === 'delete') await deleteUser(username);
    });
  }

  function readUserAccounts() {
    try {
      const storedUsers = readStoredUserAccounts();
      const normalized = uniqueUsers([...projectFileUserAccounts(), ...storedUsers]);

      if (!normalized.some((user) => user.role === 'administrador')) {
        normalized.unshift(projectFileUserAccounts()[0]);
      }

      return uniqueUsers(normalized);
    } catch (error) {
      return projectFileUserAccounts();
    }
  }

  function readStoredUserAccounts() {
    try {
      const stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '[]');
      return normalizeUserList(stored);
    } catch (error) {
      return [];
    }
  }

  async function refreshProjectUserAccounts() {
    try {
      if (!isAdmin()) return projectUserAccounts;
      const packet = await apiRequest(USER_API_URL);
      projectUserAccounts = normalizeUserList(packet.users);
    } catch (error) {
      showToast(error.message);
    }

    return projectUserAccounts;
  }

  function projectFileUserAccounts() {
    const source = projectUserAccounts.length > 0 ? projectUserAccounts : FALLBACK_USER_ACCOUNTS;
    return normalizeUserList(source);
  }

  function normalizeUserList(users) {
    return uniqueUsers((Array.isArray(users) ? users : []).filter((user) => (
      user?.username && user?.role
    )));
  }

  function isProjectFileUser(username) {
    const key = normalizeUsername(username);
    return projectFileUserAccounts().some((user) => user.username === key);
  }

  function isStoredUser(username) {
    const key = normalizeUsername(username);
    return readStoredUserAccounts().some((user) => user.username === key);
  }

  function saveUserAccounts(users, options = {}) {
    const includeProjectUsers = options.includeProjectUsers === true;
    const localUsers = uniqueUsers(users)
      .filter((user) => includeProjectUsers || !isProjectFileUser(user.username));
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(localUsers));
  }

  async function syncUsersFile(users) {
    if (!isAdmin()) return false;

    const adminPassword = requestAdminFilePassword();
    if (adminPassword === null) return false;

    const response = await fetch(USER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        adminUsername: currentUser.username,
        adminPassword,
        users: uniqueUsers(users),
      }),
    });

    const packet = await response.json().catch(() => ({}));
    if (!response.ok || packet.ok !== true) {
      if (response.status === 403) adminFilePassword = '';
      throw new Error(packet.message || 'Nao foi possivel atualizar data/users.json.');
    }

    projectUserAccounts = normalizeUserList(packet.users);
    saveUserAccounts(projectUserAccounts);
    return true;
  }

  function requestAdminFilePassword() {
    if (adminFilePassword) return adminFilePassword;

    const password = window.prompt('Informe a senha do administrador para atualizar data/users.json:');
    if (password === null) return null;

    adminFilePassword = password;
    return adminFilePassword;
  }

  function exportUsers() {
    if (!isAdmin()) {
      showToast('Acesso permitido apenas para administrador.');
      return;
    }

    writeAccessLog('export_users', 'Usuários exportados');
    downloadJson(fileName('usuarios', 'acesso'), {
      schemaVersion: 1,
      kind: 'users',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser,
      users: readUserAccounts(),
    });
  }

  async function importUsersFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const packet = JSON.parse(await file.text());
      const importedUsers = Array.isArray(packet) ? packet : packet.users;
      if (!Array.isArray(importedUsers) || importedUsers.length === 0) {
        showToast('Arquivo de usuários inválido.');
        return;
      }

      const normalizedImportedUsers = uniqueUsers(
        importedUsers.filter((user) => user?.username && user?.password && user?.role),
      );

      if (!normalizedImportedUsers.some((user) => user.role === 'administrador')) {
        showToast('O arquivo precisa conter pelo menos um administrador.');
        return;
      }

      const mergedUsers = uniqueUsers([
        ...readUserAccounts(),
        ...normalizedImportedUsers,
      ]);
      const importedFromAdmin = event.target.id === 'adminImportUsers' && isAdmin();
      let savedGlobally = false;
      if (importedFromAdmin) {
        try {
          savedGlobally = await syncUsersFile(mergedUsers);
        } catch (error) {
          showToast(error.message);
        }
      }

      saveUserAccounts(mergedUsers, {includeProjectUsers: !savedGlobally});
      writeAccessLog('import_users', `${normalizedImportedUsers.length} usuário(s) importado(s)`);
      renderLoginGroupRequirement();
      if (currentUser) render();
      showToast(savedGlobally
        ? `${normalizedImportedUsers.length} usuario(s) importado(s) no arquivo.`
        : `${normalizedImportedUsers.length} usuario(s) importado(s) neste aparelho.`);
    } catch (error) {
      showToast('Não foi possível importar usuários.');
    } finally {
      event.target.value = '';
    }
  }

  function uniqueUsers(users) {
    const byUsername = new Map();
    users.forEach((user) => {
      byUsername.set(normalizeUsername(user.username), {
        username: normalizeUsername(user.username),
        password: String(user.password || ''),
        name: String(user.name || user.username),
        role: normalizeRole(user.role),
      });
    });
    return Array.from(byUsername.values());
  }

  function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  function normalizeRole(role) {
    return ['administrador', 'supervisor'].includes(role) ? role : 'contador';
  }

  function normalizeCountGroups(value) {
    const values = Array.isArray(value) ? value : [value];
    const groups = values.filter((groupId) => assignableGroupIds.includes(groupId));
    return groups.length > 0 ? Array.from(new Set(groups)) : [assignableGroupIds[0]];
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);
      return {
        id: session.id,
        username: session.username,
        name: session.name,
        role: session.role,
        countGroups: (session.countGroups || session.countGroup)
          ? normalizeCountGroups(session.countGroups || session.countGroup)
          : [],
        loginAt: session.loginAt || new Date().toISOString(),
      };
    } catch (error) {
      return null;
    }
  }

  async function restoreServerSession() {
    const localSession = loadSession();
    try {
      const packet = await apiRequest(AUTH_API_URL);
      if (!packet.user) {
        currentUser = null;
        localStorage.removeItem(AUTH_SESSION_KEY);
        return;
      }
      currentUser = {
        ...packet.user,
        countGroups: localSession?.countGroups?.length
          ? normalizeCountGroups(localSession.countGroups)
          : [],
        loginAt: localSession?.loginAt || new Date().toISOString(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
    } catch (error) {
      currentUser = null;
    }
  }

  function bindEventSelection() {
    const filter = document.getElementById('eventFilterDate');
    filter.value = today();
    document.getElementById('historyFilterDate').value = '';
    document.getElementById('selectionDeviceName').value = state.deviceName;
    filter.addEventListener('change', loadAvailableEvents);
    document.getElementById('availableEventSelect').addEventListener('change', () => checkSelectedGroupAvailability());
    document.querySelectorAll('[name="selectionCountGroups"]').forEach((input) => {
      input.addEventListener('change', checkSelectedGroupAvailability);
    });
    document.getElementById('confirmEventSelection').addEventListener('click', confirmEventSelection);
    document.getElementById('createEventButton').addEventListener('click', createEvent);
    document.getElementById('eventAgendaList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-edit-agenda-event]');
      if (button) editAgendaEvent(button.dataset.editAgendaEvent);
    });
    document.getElementById('historyFilterDate').addEventListener('change', renderEventHistory);
    document.getElementById('eventHistoryBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-history-event]');
      if (button) viewHistoricalReport(button.dataset.historyEvent);
    });
    document.getElementById('closeHistoricalReport').addEventListener('click', () => {
      document.getElementById('historicalReportWrap').classList.add('is-hidden');
    });
    document.getElementById('printHistoricalReport').addEventListener('click', () => {
      document.body.classList.add('printing-history');
      window.print();
      window.setTimeout(() => document.body.classList.remove('printing-history'), 500);
    });
  }

  async function loadAvailableEvents() {
    if (!currentUser) return;
    const date = document.getElementById('eventFilterDate')?.value || '';
    try {
      const packet = await apiRequest(`${EVENTS_API_URL}${date ? `?date=${encodeURIComponent(date)}` : ''}`);
      availableEvents = packet.events || [];
      const select = document.getElementById('availableEventSelect');
      select.innerHTML = '<option value="">Selecione um evento</option>' + availableEvents.map((event) => (
        `<option value="${escapeHtml(event.eventKey)}">${escapeHtml(`${formatDate(event.date)} - ${event.name} - ${event.type}`)}</option>`
      )).join('');
      await renderEventHistory();
    } catch (error) {
      document.getElementById('selectionError').textContent = error.message;
    }
  }

  function pendingSelectedEvent() {
    const key = document.getElementById('availableEventSelect')?.value;
    return availableEvents.find((event) => event.eventKey === key) || null;
  }

  async function confirmEventSelection() {
    const event = pendingSelectedEvent();
    const groups = selectedLoginCountGroups();
    const deviceName = document.getElementById('selectionDeviceName').value.trim();
    const error = document.getElementById('selectionError');
    if (!event || groups.length === 0 || !deviceName) {
      error.textContent = 'Selecione o evento, ao menos um grupo e informe o nome do aparelho.';
      return;
    }
    if (event.status === 'finalizado') {
      error.textContent = 'Este evento já foi finalizado. Consulte o relatório pelo Histórico.';
      return;
    }
    try {
      await apiRequest(ASSIGNMENTS_API_URL, {method:'POST',body:JSON.stringify({
        action:'reserve',event,countGroups:groups,deviceId:state.deviceId,deviceName,
      })});
      if (state.selectedEventKey !== event.eventKey) {
        state.counts = emptyCounts();
        state.imports = {};
      }
      state.event = {...event};
      state.selectedEventKey = event.eventKey;
      state.deviceName = deviceName;
      state.selectedGroup = groups[0];
      state.activeTab = 'count';
      currentUser.countGroups = groups;
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
      saveState();
      error.textContent = '';
      render();
      await loadRemoteCounts();
      showToast('Evento e grupos selecionados. Contagem liberada.');
    } catch (requestError) {
      const message = requestError.message || 'Não foi possível reservar os grupos.';
      error.textContent = message;
      window.alert(message);
      await checkSelectedGroupAvailability();
    }
  }

  async function createEvent() {
    if (!isManager()) return;
    try {
      const originalEventKey = editingEventKey;
      const packet = await apiRequest(EVENTS_API_URL,{method:'POST',body:JSON.stringify({
        event:state.event,
        originalEventKey,
      })});
      if (originalEventKey && state.selectedEventKey === originalEventKey) {
        state.selectedEventKey = packet.eventKey;
      }
      editingEventKey = '';
      document.getElementById('createEventButton').textContent = 'Criar / atualizar evento';
      showToast(originalEventKey ? 'Evento atualizado no Neon.' : 'Evento salvo no Neon.');
      await loadAvailableEvents();
      state.activeTab = originalEventKey ? 'agenda' : 'history';
      saveState();
      render();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function renderEventHistory() {
    if (!currentUser) return;
    const date = document.getElementById('historyFilterDate')?.value || '';
    try {
      const packet = await apiRequest(`${EVENTS_API_URL}${date ? `?date=${encodeURIComponent(date)}` : ''}`);
      const events = packet.events || [];
      historyEvents = events;
      document.getElementById('eventHistoryBody').innerHTML = events.length ? events.map((event) => `
        <tr><td>${escapeHtml(formatDate(event.date))}</td><td>${escapeHtml(event.name)}</td>
        <td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.local || '-')}</td>
        <td>${escapeHtml(event.createdBy || '-')}</td><td>${safeNumber(event.deviceCount)}</td>
        <td>${event.status === 'finalizado'
          ? `<button class="table-action" type="button" data-history-event="${escapeHtml(event.eventKey)}">Visualizar / PDF</button>`
          : '<button class="table-action" type="button" disabled>Aguardando finalização</button>'}</td></tr>
      `).join('') : '<tr><td colspan="7">Nenhum evento encontrado.</td></tr>';
    } catch (error) {
      document.getElementById('eventHistoryBody').innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  async function viewHistoricalReport(eventKey) {
    const event = historyEvents.find((item) => item.eventKey === eventKey);
    if (!event || event.status !== 'finalizado') {
      showToast('O relatório só fica disponível após a finalização do evento.');
      return;
    }
    const query = new URLSearchParams({date:event.date,type:event.type,name:event.name,local:event.local || ''});
    try {
      const packet = await apiRequest(`${SYNC_API_URL}?${query}`);
      const counts = emptyCounts();
      (packet.devices || []).forEach((device) => {
        const deviceCounts = normalizeCounts(device.counts);
        catalog.forEach((group) => group.items.forEach(([itemId]) => {
          counts[group.id][itemId] += safeNumber(deviceCounts[group.id][itemId]);
        }));
      });
      renderHistoricalReport(event, counts, (packet.devices || []).length);
      document.getElementById('historicalReportWrap').classList.remove('is-hidden');
      document.getElementById('historicalReportWrap').scrollIntoView({behavior:'smooth',block:'start'});
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderHistoricalReport(event, counts, deviceCount) {
    const totals = calculateTotals(counts, event.type);
    document.getElementById('historicalReportSubtitle').textContent = [event.name,event.type,formatDate(event.date),event.local,event.region].filter(Boolean).join(' | ');
    document.getElementById('historicalReportMeta').innerHTML = [
      ['Evento',event.name],['Tipo',event.type],['Data',formatDate(event.date)],['Local',event.local || '-'],
      ['Região',event.region || '-'],['Aparelhos consolidados',String(deviceCount)],['Criado por',event.createdBy || '-'],
    ].map(([label,value]) => `<div class="meta-line"><strong>${escapeHtml(label)}:</strong><span>${escapeHtml(value)}</span></div>`).join('');
    const totalRows = isInstructorMeetingType(event.type)
      ? [['Total de instrutores',totals.totalMusicos],['Total geral',totals.totalGeralPresentes]]
      : [['Total de músicos',totals.totalMusicos],['Total de organistas',totals.totalOrganistas],['Músicos + organistas',totals.totalMusicosOrganistas],['Total geral',totals.totalGeralPresentes]];
    document.getElementById('historicalTotalsGrid').innerHTML = totalRows.map(([label,value]) => `<div class="total-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join('');
    document.getElementById('historicalTableGrid').innerHTML = catalogForEventType(event.type).map((group) => {
      const rows = group.items.map(([itemId,label]) => `<tr><td>${escapeHtml(itemLabelForEvent(label, group.id, event.type))}</td><td>${safeNumber(counts[group.id]?.[itemId])}</td></tr>`).join('');
      return `<table class="report-table"><caption>${escapeHtml(group.label)}</caption><thead><tr><th>Item</th><th>Qtd.</th></tr></thead><tbody>${rows}<tr class="subtotal-row"><td>Subtotal</td><td>${groupSubtotal(counts,group.id)}</td></tr></tbody></table>`;
    }).join('');
  }

  async function renderAgenda() {
    if (!currentUser || state.activeTab !== 'agenda') return;
    const list = document.getElementById('eventAgendaList');
    try {
      const packet = await apiRequest(`${EVENTS_API_URL}?upcoming=1`);
      const events = packet.events || [];
      agendaEvents = events;
      list.innerHTML = events.length ? events.map((event) => {
        const eventDate = new Date(`${event.date}T12:00:00`);
        const todayDate = new Date(`${today()}T12:00:00`);
        const days = Math.round((eventDate - todayDate) / 86400000);
        const when = days === 0 ? 'Hoje' : (days === 1 ? 'Amanhã' : `Em ${days} dias`);
        return `
          <article class="panel agenda-item">
            <div class="agenda-date"><strong>${escapeHtml(formatDate(event.date))}</strong><span>${escapeHtml(when)}</span></div>
            <div class="agenda-details">
              <h2>${escapeHtml(event.name)}</h2><p>${escapeHtml(event.type)}</p>
              <span>${escapeHtml([event.local, event.region].filter(Boolean).join(' | ') || 'Local a definir')}</span>
              <small>Agendado por ${escapeHtml(event.createdBy || '-')}</small>
            </div>
            ${isManager() ? `<div class="agenda-actions"><button class="button subtle" type="button" data-edit-agenda-event="${escapeHtml(event.eventKey)}">Editar evento</button></div>` : ''}
          </article>`;
      }).join('') : '<article class="panel"><p class="muted">Nenhum evento futuro agendado.</p></article>';
    } catch (error) {
      list.innerHTML = `<article class="panel"><p class="muted">${escapeHtml(error.message)}</p></article>`;
    }
  }

  function editAgendaEvent(eventKey) {
    if (!isManager()) {
      showToast('Somente Administrador ou Supervisor pode editar eventos.');
      return;
    }
    const event = agendaEvents.find((item) => item.eventKey === eventKey);
    if (!event) return;
    editingEventKey = event.eventKey;
    state.event = {
      ...state.event,
      name: event.name,
      type: event.type,
      date: event.date,
      local: event.local || '',
      regionalLeader: event.regionalLeader || '',
      elder: event.elder || '',
      region: event.region || '',
    };
    state.activeTab = 'event';
    document.getElementById('createEventButton').textContent = 'Salvar alterações';
    saveState();
    render();
    document.getElementById('view-event').scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function checkSelectedGroupAvailability() {
    const selectedGroups = selectedLoginCountGroups();
    const error = document.getElementById('selectionError');
    const event = pendingSelectedEvent();
    if (!event) {
      document.getElementById('groupAvailabilityMessage').textContent = 'Selecione um evento para verificar os grupos.';
      return;
    }
    try {
      const packet = await apiRequest(ASSIGNMENTS_API_URL, {
        method: 'POST',
        body: JSON.stringify({event, countGroups: assignableGroupIds}),
      });
      const conflicts = packet.conflicts || [];
      const byGroup = new Map(conflicts.map((item) => [item.groupId, item]));
      const selectedConflicts = conflicts.filter((item) => selectedGroups.includes(item.groupId));

      document.querySelectorAll('[name="selectionCountGroups"]').forEach((input) => {
        const conflict = byGroup.get(input.value);
        const label = input.closest('label');
        label.querySelector('.group-occupied-note')?.remove();
        input.disabled = Boolean(conflict);
        label.classList.toggle('is-group-occupied', Boolean(conflict));
        if (conflict) {
          input.checked = false;
          const note = document.createElement('small');
          note.className = 'group-occupied-note';
          note.textContent = `Em contagem por ${conflict.userName}`;
          label.appendChild(note);
        }
      });

      document.getElementById('groupAvailabilityMessage').textContent = conflicts.length
        ? `${conflicts.length} grupo(s) já estão em contagem. Os itens ocupados ficam bloqueados.`
        : 'Todos os grupos estão disponíveis para este evento.';
      error.textContent = selectedConflicts.length
        ? `Grupo já em contagem por ${selectedConflicts.map((item) => item.userName).join(', ')}.`
        : '';
      if (selectedConflicts.length) {
        window.alert(selectedConflicts.map((item) => (
          `${groupLabel(item.groupId)} já está em contagem pelo usuário ${item.userName}.`
        )).join('\n'));
      }
    } catch (requestError) {
      error.textContent = requestError.message;
    }
  }

  async function logout() {
    writeAccessLog('logout', 'Saída do sistema');
    await apiRequest(AUTH_API_URL, {method: 'DELETE'}).catch(() => null);
    localStorage.removeItem(AUTH_SESSION_KEY);
    currentUser = null;
    renderAuth();
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', ...(options.headers || {})},
      ...options,
    });
    const packet = await response.json().catch(() => ({}));
    if (!response.ok || packet.ok === false) {
      throw new Error(packet.message || 'Não foi possível comunicar com o servidor.');
    }
    return packet;
  }

  function renderAuth() {
    const loggedIn = Boolean(currentUser);
    document.getElementById('loginScreen').classList.toggle('is-hidden', loggedIn);
    document.getElementById('appShell').classList.toggle('is-hidden', !loggedIn);

    if (!loggedIn) {
      document.getElementById('loginPassword').value = '';
      renderLoginGroupRequirement();
      document.getElementById('loginUser').focus();
      return;
    }

    document.getElementById('currentUserChip').textContent = currentUser.name;

    document.querySelectorAll('.admin-only').forEach((element) => {
      element.classList.toggle('is-hidden', !isAdmin());
    });
    document.querySelectorAll('.manager-only').forEach((element) => {
      element.classList.toggle('is-hidden', !isManager());
    });

    if (!isAdmin() && state.activeTab === 'admin') {
      state.activeTab = 'select-event';
      saveState();
    }
    if (!isManager() && state.activeTab === 'event') {
      state.activeTab = 'select-event';
      saveState();
    }
  }

  function isAdmin() {
    return currentUser?.role === 'administrador';
  }

  function isManager() {
    return ['administrador', 'supervisor'].includes(currentUser?.role);
  }

  function readAccessLogs() {
    try {
      const logs = JSON.parse(localStorage.getItem(ACCESS_LOG_KEY) || '[]');
      return Array.isArray(logs) ? logs : [];
    } catch (error) {
      return [];
    }
  }

  function writeAccessLog(action, details) {
    const logs = readAccessLogs();
    logs.unshift({
      id: createId('log'),
      at: new Date().toISOString(),
      username: currentUser?.username || 'sem_login',
      name: currentUser?.name || '-',
      role: currentUser?.role || '-',
      action,
      details: details || '',
      deviceName: state?.deviceName || '',
      userAgent: navigator.userAgent,
    });
    localStorage.setItem(ACCESS_LOG_KEY, JSON.stringify(logs.slice(0, 500)));
  }

  function exportAccessLogs() {
    if (!isAdmin()) {
      showToast('Acesso permitido apenas para administrador.');
      return;
    }

    writeAccessLog('export_logs', 'Logs exportados');
    downloadJson(fileName('logs-acesso', currentUser.username), {
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser,
      logs: readAccessLogs(),
    });
    renderAdmin();
  }

  function clearAccessLogs() {
    if (!isAdmin()) {
      showToast('Acesso permitido apenas para administrador.');
      return;
    }

    const confirmation = window.confirm('Deseja limpar os logs deste navegador?');
    if (!confirmation) return;

    localStorage.removeItem(ACCESS_LOG_KEY);
    writeAccessLog('clear_logs', 'Logs limpos pelo administrador');
    renderAdmin();
    showToast('Logs limpos.');
  }

  async function saveUserFromForm() {
    if (!isAdmin()) {
      showToast('Acesso permitido apenas para administrador.');
      return;
    }

    const editKey = normalizeUsername(document.getElementById('userEditKey').value);
    const username = normalizeUsername(document.getElementById('userUsername').value);
    const name = document.getElementById('userName').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = normalizeRole(document.getElementById('userRole').value);

    if (!username || username.length < 3) {
      showToast('Informe um usuário com pelo menos 3 caracteres.');
      return;
    }

    if (!/^[a-z0-9._-]+$/.test(username)) {
      showToast('Use apenas letras, números, ponto, traço ou sublinhado no usuário.');
      return;
    }

    if (!name) {
      showToast('Informe o nome do usuário.');
      return;
    }

    const existing = projectUserAccounts.find((user) => user.username === (editKey || username));
    if (!existing && !password) {
      showToast('Informe uma senha para o novo usuário.');
      return;
    }

    try {
      await apiRequest(USER_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'save', originalUsername: editKey || username, username, name, role, password,
        }),
      });
      await refreshProjectUserAccounts();
    } catch (error) {
      showToast(error.message);
      return;
    }

    if (currentUser?.username === editKey || currentUser?.username === username) {
      const updatedCurrentUser = projectUserAccounts.find((user) => user.username === username);
      currentUser = {
        username: updatedCurrentUser.username,
        name: updatedCurrentUser.name,
        role: updatedCurrentUser.role,
        countGroups: currentUser.countGroups?.length
          ? normalizeCountGroups(currentUser.countGroups || currentUser.countGroup)
          : [],
        loginAt: currentUser.loginAt,
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
    }

    writeAccessLog(existing ? 'update_user' : 'create_user', username);
    resetUserForm();
    render();
    showToast(existing ? 'Usuário atualizado no Neon.' : 'Usuário criado no Neon.');
  }

  function editUser(username) {
    if (!isAdmin()) return;

    const user = projectUserAccounts.find((item) => item.username === username);
    if (!user) return;

    document.getElementById('userEditKey').value = user.username;
    document.getElementById('userName').value = user.name;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Deixe em branco para manter';
    document.getElementById('userRole').value = user.role;
  }

  async function deleteUser(username) {
    if (!isAdmin()) return;

    if (username === currentUser.username) {
      showToast('Não é possível excluir o usuário logado.');
      return;
    }

    const user = projectUserAccounts.find((item) => item.username === username);
    if (!user) return;

    const confirmation = window.confirm(`Deseja excluir o usuário ${user.name}?`);
    if (!confirmation) return;

    try {
      await apiRequest(USER_API_URL, {
        method: 'POST', body: JSON.stringify({action: 'delete', username}),
      });
      await refreshProjectUserAccounts();
    } catch (error) {
      showToast(error.message);
      return;
    }
    writeAccessLog('delete_user', username);
    resetUserForm();
    render();
    showToast('Usuário excluído do Neon.');
  }

  async function resetUserPassword(username) {
    if (!isAdmin()) return;

    const user = projectUserAccounts.find((item) => item.username === username);
    if (!user) return;

    const newPassword = window.prompt(`Informe a nova senha para ${user.name}:`);
    if (newPassword === null) return;

    if (newPassword.trim().length < 4) {
      showToast('A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }

    try {
      await apiRequest(USER_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'save', originalUsername: username, username,
          name: user.name, role: user.role, password: newPassword.trim(),
        }),
      });
    } catch (error) {
      showToast(error.message);
      return;
    }
    writeAccessLog('reset_password', username);
    render();
    showToast('Senha redefinida no Neon.');
  }

  function resetUserForm() {
    document.getElementById('userEditKey').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Obrigatória para novo usuário';
    document.getElementById('userRole').value = 'contador';
  }

  function bindInputs() {
    const bindings = [
      ['eventName', 'name'],
      ['eventType', 'type'],
      ['eventDate', 'date'],
      ['eventLocal', 'local'],
      ['eventRegionalLeader', 'regionalLeader'],
      ['eventElder', 'elder'],
      ['eventRegion', 'region'],
      ['deviceName', 'deviceName'],
    ];

    bindings.forEach(([elementId, field]) => {
      const element = document.getElementById(elementId);
      element.addEventListener('input', updateValue);
      element.addEventListener('change', updateValue);

      function updateValue() {
        if (field === 'deviceName') {
          state.deviceName = element.value;
        } else {
          state.event[field] = element.value;
        }
        ensureSelectedGroup();
        saveState();
        if (field === 'type') {
          render();
        } else {
          renderConditionalLeaderFields();
          renderReport();
        }
      }
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
      activeTab: 'select-event',
      selectedEventKey: '',
      selectedGroup: 'cordas',
      event: {
        name: 'Contagem de Músicos e Organistas',
        type: 'Reunião de encarregados e instrutores',
        date: today(),
        local: '',
        regionalLeader: '',
        elder: '',
        region: '',
        status: 'em_andamento',
        finalizedAt: null,
      },
      counts: emptyCounts(),
      imports: {},
    };
  }

  function normalizeState(raw) {
    const normalizedEvent = {
      ...defaultState().event,
      ...(raw.event || {}),
    };

    if (!eventTypes.includes(normalizedEvent.type)) {
      normalizedEvent.type = eventTypes[0];
    }

    const availableGroups = catalogForEventType(normalizedEvent.type);

    return {
      ...raw,
      event: normalizedEvent,
      counts: normalizeCounts(raw.counts || {}),
      imports: raw.imports && typeof raw.imports === 'object' ? raw.imports : {},
      selectedGroup: availableGroups.some((group) => group.id === raw.selectedGroup)
        ? raw.selectedGroup
        : availableGroups[0].id,
      activeTab: ['select-event', 'event', 'count', 'sync', 'report', 'agenda', 'history', 'admin'].includes(raw.activeTab)
        ? raw.activeTab
        : 'select-event',
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
    scheduleSynchronization();
  }

  function scheduleSynchronization() {
    if (!currentUser || !state.selectedEventKey || !currentUser.countGroups?.length) return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => synchronizeCounts(false), 900);
  }

  async function synchronizeCounts(showResult = false) {
    if (!currentUser || !state.selectedEventKey || !currentUser.countGroups?.length || syncInProgress || !state.event.date || !state.event.type || isEventFinalized()) return false;
    syncInProgress = true;
    try {
      await apiRequest(SYNC_API_URL, {
        method: 'POST',
        body: JSON.stringify({
          event: state.event,
          deviceId: state.deviceId,
          deviceName: state.deviceName,
          counts: normalizeCounts(state.counts),
          countGroups: currentUser.countGroups || [],
          updatedAt: new Date().toISOString(),
        }),
      });
      await loadRemoteCounts(false);
      writeAccessLog('sync_counts', 'Contagem sincronizada com o Neon');
      if (showResult) showToast('Contagem sincronizada e relatório consolidado atualizado.');
      return true;
    } catch (error) {
      if (error.message.includes('finalizado')) {
        state.event.status = 'finalizado';
        render();
      }
      if (showResult) showToast(`${error.message} Os dados continuam salvos neste aparelho.`);
      return false;
    } finally {
      syncInProgress = false;
    }
  }

  async function loadRemoteCounts(renderAfter = true) {
    if (!currentUser || !state.event.date || !state.event.type) return;
    const query = new URLSearchParams({
      date: state.event.date,
      type: state.event.type,
      name: state.event.name || '',
      local: state.event.local || '',
    });
    try {
      const packet = await apiRequest(`${SYNC_API_URL}?${query}`);
      state.event.status = packet.status || 'em_andamento';
      state.event.finalizedAt = packet.finalizedAt || null;
      state.imports = {};
      (packet.devices || []).forEach((device) => {
        if (device.deviceId === state.deviceId) return;
        state.imports[device.deviceId] = {
          schemaVersion: 1,
          kind: 'device-counts',
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          exportedAt: device.updatedAt,
          event: {...state.event},
          counts: normalizeCounts(device.counts),
          username: device.username,
          userName: device.userName,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (renderAfter) render();
    } catch (error) {
      if (renderAfter) showToast(`${error.message} Exibindo a última consolidação disponível.`);
    }
  }

  function render() {
    if (!currentUser) return;
    renderAuth();
    renderTabs();
    renderInputs();
    ensureSelectedGroup();
    renderGroups();
    renderCounters();
    renderEventStatus();
    renderSummary();
    renderImports();
    renderReport();
    renderAgenda();
    renderAdmin();
  }

  function renderTabs() {
    if (state.activeTab === 'report' && !isEventFinalized()) {
      state.activeTab = state.selectedEventKey ? 'count' : 'select-event';
      saveState();
    }
    if (!isAdmin() && state.activeTab === 'admin') {
      state.activeTab = 'select-event';
      saveState();
    }

    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tab === state.activeTab);
    });
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.toggle('is-active', view.id === `view-${state.activeTab}`);
    });
  }

  function renderInputs() {
    setInputValue('eventName', state.event.name);
    setInputValue('eventType', state.event.type);
    setInputValue('eventDate', state.event.date);
    setInputValue('eventLocal', state.event.local);
    setInputValue('eventRegionalLeader', state.event.regionalLeader);
    setInputValue('eventElder', state.event.elder);
    setInputValue('eventRegion', state.event.region);
    setInputValue('deviceName', state.deviceName);
    renderConditionalLeaderFields();
  }

  function setInputValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (document.activeElement !== element) {
      element.value = value || '';
    }
  }

  function eventLeaderLabels() {
    if (state.event.type === 'Ensaio Regional') {
      return ['Nome do Encarregado Regional', 'Nome do Ancião'];
    }

    if (state.event.type === 'Reunião de encarregados e instrutores') {
      return ['Encarregado regional ministrante', 'Ancião'];
    }

    return null;
  }

  function renderConditionalLeaderFields() {
    const labels = eventLeaderLabels();
    const regionalField = document.getElementById('regionalLeaderField');
    const elderField = document.getElementById('elderField');

    regionalField.classList.toggle('is-hidden', !labels);
    elderField.classList.toggle('is-hidden', !labels);

    if (!labels) return;

    document.getElementById('regionalLeaderLabel').textContent = labels[0];
    document.getElementById('elderLabel').textContent = labels[1];
  }

  function catalogForEventType(eventType) {
    return catalog;
  }

  function activeCatalog() {
    return catalogForEventType(state.event.type);
  }

  function countCatalog() {
    const availableGroups = activeCatalog();
    if (!currentUser?.countGroups?.length) return availableGroups;

    const allowedGroups = normalizeCountGroups(currentUser.countGroups || currentUser.countGroup);
    return availableGroups.filter((group) => allowedGroups.includes(group.id));
  }

  function isInstructorMeetingType(eventType) {
    return eventType === eventTypes[0];
  }

  function ensureSelectedGroup() {
    const availableGroups = countCatalog();
    if (!availableGroups.some((group) => group.id === state.selectedGroup)) {
      state.selectedGroup = availableGroups[0].id;
    }
  }

  function groupLabel(groupId) {
    return catalog.find((group) => group.id === groupId)?.label || groupId;
  }

  function groupLabels(groupIds) {
    return groupIds.map(groupLabel).join(', ');
  }

  function itemLabelForEvent(label, groupId, eventType) {
    if (isInstructorMeetingType(eventType) && instrumentGroupIds.includes(groupId)) {
      return `Instrutores - ${label}`;
    }

    return label;
  }

  function itemLabelForCurrentEvent(label, groupId) {
    return itemLabelForEvent(label, groupId, state.event.type);
  }

  function renderGroups() {
    const groupStrip = document.getElementById('groupStrip');
    groupStrip.innerHTML = countCatalog().map((group) => {
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
    const groups = countCatalog();
    const group = groups.find((item) => item.id === state.selectedGroup) || groups[0];
    const list = document.getElementById('counterList');
    list.innerHTML = group.items.map(([itemId, label]) => {
      const value = state.counts[group.id][itemId] || 0;
      return `
        <div class="counter-row">
          <div class="counter-label">${escapeHtml(itemLabelForCurrentEvent(label, group.id))}</div>
          <button class="counter-button" type="button" data-delta="-1" data-group="${group.id}" data-item="${itemId}" ${isEventFinalized() ? 'disabled' : ''}>-</button>
          <div class="counter-value">${value}</div>
          <button class="counter-button plus" type="button" data-delta="1" data-group="${group.id}" data-item="${itemId}" ${isEventFinalized() ? 'disabled' : ''}>+</button>
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

  function isEventFinalized() {
    return state.event?.status === 'finalizado';
  }

  function renderEventStatus() {
    const finalized = isEventFinalized();
    const countStatus = document.getElementById('countEventStatus');
    const reportStatus = document.getElementById('reportEventStatus');
    const finalizeButton = document.getElementById('finalizeEventButton');
    const reportTab = document.querySelector('[data-tab="report"]');
    const syncButton = document.querySelector('[data-action="sync-now"]');
    countStatus.classList.toggle('is-hidden', !finalized);
    countStatus.classList.toggle('is-finalized', finalized);
    countStatus.textContent = finalized
      ? 'Evento finalizado pelo Administrador. A contagem está bloqueada.'
      : '';
    reportStatus.classList.toggle('is-hidden', !state.selectedEventKey);
    reportStatus.classList.toggle('is-finalized', finalized);
    reportStatus.textContent = finalized
      ? 'Contagem finalizada. O relatório consolidado está liberado.'
      : 'Relatório indisponível enquanto a contagem estiver em andamento.';
    finalizeButton.disabled = finalized || !state.selectedEventKey;
    finalizeButton.textContent = finalized ? 'Contagem encerrada' : 'Encerrar contagem do evento';
    reportTab.disabled = !finalized;
    syncButton.disabled = finalized;
  }

  async function finalizeEvent() {
    if (!isAdmin() || !state.selectedEventKey || isEventFinalized()) return;
    if (!window.confirm('Encerrar a contagem deste evento? Após a finalização, nenhum contador poderá alterar os números.')) return;
    const synchronized = await synchronizeCounts(true);
    if (!synchronized) {
      showToast('Não foi possível sincronizar a última contagem. O evento não foi encerrado.');
      return;
    }
    try {
      const packet = await apiRequest(EVENTS_API_URL, {method:'POST', body:JSON.stringify({
        action:'finalize', eventKey:state.selectedEventKey,
      })});
      state.event.status = packet.status;
      state.event.finalizedAt = packet.finalizedAt || new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      await loadRemoteCounts(false);
      render();
      showToast('Contagem encerrada. O relatório final foi liberado.');
    } catch (error) {
      showToast(error.message);
    }
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
      ['Outros aparelhos', importedDevices],
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
      .filter((packet) => isCompatiblePacket(packet))
      .sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)));
    const list = document.getElementById('importList');

    if (imports.length === 0) {
      list.innerHTML = '<p class="muted">Nenhum outro aparelho sincronizado neste evento.</p>';
      return;
    }

    list.innerHTML = imports.map((packet) => {
      const totals = calculateTotals(normalizeCounts(packet.counts), packet.event?.type);
      return `
        <div class="import-item">
          <strong>${escapeHtml(packet.deviceName || 'Aparelho sem nome')}</strong>
          <span>Data: ${formatDate(packet.event?.date)} | Total registrado: ${totals.totalGeralPresentes}</span>
          <span>Sincronizado por ${escapeHtml(packet.userName || packet.username || packet.deviceId || '')} em ${formatDateTime(packet.exportedAt)}</span>
        </div>
      `;
    }).join('');
  }

  function renderReport() {
    const merged = mergedCounts();
    const totals = calculateTotals(merged);
    const subtitleParts = [
      state.event.name,
      state.event.type,
      formatDate(state.event.date),
      state.event.local,
      state.event.region,
    ].filter(Boolean);

    document.getElementById('reportSubtitle').textContent = subtitleParts.join(' | ');

    const leaderLabels = eventLeaderLabels();
    const metaRows = [
      ['Evento', state.event.name],
      ['Tipo de evento', state.event.type || '-'],
      ['Data', formatDate(state.event.date)],
      ['Local', state.event.local || '-'],
    ];

    if (leaderLabels) {
      metaRows.push(
        [leaderLabels[0], state.event.regionalLeader || '-'],
        [leaderLabels[1], state.event.elder || '-'],
      );
    }

    metaRows.push(
      ['Região', state.event.region || '-'],
      ['Outros aparelhos sincronizados', String(Object.keys(state.imports).length)],
    );

    document.getElementById('reportMeta').innerHTML = metaRows.map(([label, value]) => `
      <div class="meta-line"><strong>${escapeHtml(label)}:</strong><span>${escapeHtml(value)}</span></div>
    `).join('');

    const totalRows = isInstructorMeetingType(state.event.type) ? [
      ['Total de instrutores', totals.totalMusicos],
      ['Total geral de presentes', totals.totalGeralPresentes],
    ] : [
      ['Total de músicos', totals.totalMusicos],
      ['Total de organistas', totals.totalOrganistas],
      ['Músicos + organistas', totals.totalMusicosOrganistas],
      ['Ministério e colaboradores', totals.totalMinisterioColaboradores],
      ['Oficialização', totals.totalOficializacao],
      ['Total geral de presentes', totals.totalGeralPresentes],
    ];

    document.getElementById('totalsGrid').innerHTML = totalRows.map(([label, value]) => `
      <div class="total-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
    `).join('');

    renderChart(merged);
    renderTables(merged);
  }

  function renderAdmin() {
    if (!isAdmin()) return;

    renderUsers();
    const logs = readAccessLogs();
    document.getElementById('logCount').textContent = `${logs.length} registro(s)`;
    document.getElementById('logTableBody').innerHTML = logs.length === 0
      ? '<tr><td colspan="5">Nenhum log registrado.</td></tr>'
      : logs.map((log) => `
        <tr>
          <td>${escapeHtml(formatDateTime(log.at))}</td>
          <td>${escapeHtml(log.name || log.username || '-')}</td>
          <td>${escapeHtml(log.role || '-')}</td>
          <td>${escapeHtml(actionLabel(log.action))}</td>
          <td>${escapeHtml(log.details || '-')}</td>
        </tr>
      `).join('');
  }

  function renderUsers() {
    const users = [...projectUserAccounts]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    document.getElementById('userTableBody').innerHTML = users.map((user) => {
      const isCurrent = currentUser?.username === user.username;
      const sourceTag = ' <span class="source-tag">Neon</span>';
      return `
        <tr>
          <td>${escapeHtml(user.name)}${isCurrent ? ' <strong>(logado)</strong>' : ''}</td>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(roleLabel(user.role))}${sourceTag}</td>
          <td>
            <div class="table-actions">
              <button class="table-action" type="button" data-user-action="edit" data-username="${escapeHtml(user.username)}">Editar</button>
              <button class="table-action" type="button" data-user-action="reset-password" data-username="${escapeHtml(user.username)}">Resetar senha</button>
              <button class="table-action danger" type="button" data-user-action="delete" data-username="${escapeHtml(user.username)}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function roleLabel(role) {
    if (role === 'administrador') return 'Administrador';
    if (role === 'supervisor') return 'Supervisor/Secretário';
    return 'Contador';
  }

  function actionLabel(action) {
    const labels = {
      access_denied: 'Acesso negado',
      clear_imports: 'Limpou importações',
      clear_logs: 'Limpou logs',
      create_user: 'Criou usuário',
      delete_user: 'Excluiu usuário',
      export_counts: 'Exportou contagem',
      export_final_report: 'Exportou relatório final',
      export_logs: 'Exportou logs',
      export_users: 'Exportou usuários',
      import_counts: 'Importou contagens',
      import_users: 'Importou usuários',
      login_failed: 'Falha de login',
      login_success: 'Login',
      logout: 'Logout',
      open_tab: 'Abriu tela',
      print_report: 'Imprimiu relatório',
      reset_password: 'Resetou senha',
      save: 'Salvou dados',
      sync_counts: 'Sincronizou contagem',
      update_user: 'Atualizou usuário',
    };

    return labels[action] || action || '-';
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
    document.getElementById('tableGrid').innerHTML = activeCatalog().map((group) => {
      const rows = group.items.map(([itemId, label]) => `
        <tr>
          <td>${escapeHtml(itemLabelForCurrentEvent(label, group.id))}</td>
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
    writeAccessLog('export_counts', 'Contagem deste aparelho exportada');
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
    writeAccessLog('export_final_report', 'Relatório final exportado');
    showToast('Arquivo do relatório final gerado.');
  }

  async function importFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    let imported = 0;
    let replaced = 0;
    let adoptedEvent = false;
    const skippedReasons = {
      invalid: 0,
      incompatibleDate: 0,
      incompatibleType: 0,
      sameDevice: 0,
      older: 0,
      readError: 0,
    };

    for (const file of files) {
      try {
        const packet = JSON.parse(await file.text());
        if (!isValidPacket(packet)) {
          skippedReasons.invalid++;
          continue;
        }

        if (!isCompatiblePacket(packet) && canAdoptImportEvent(packet)) {
          adoptEventFromPacket(packet);
          adoptedEvent = true;
        }

        if (!isCompatiblePacket(packet)) {
          if (packet.event?.date !== state.event.date) {
            skippedReasons.incompatibleDate++;
          } else {
            skippedReasons.incompatibleType++;
          }
          continue;
        }
        if (packet.deviceId === state.deviceId) {
          skippedReasons.sameDevice++;
          continue;
        }

        const key = `${packet.event.date}:${packet.deviceId}`;
        const previous = state.imports[key];
        if (!previous || String(packet.exportedAt) >= String(previous.exportedAt)) {
          state.imports[key] = {
            ...packet,
            counts: normalizeCounts(packet.counts),
          };
          if (previous) {
            replaced++;
          } else {
            imported++;
          }
        } else {
          skippedReasons.older++;
        }
      } catch (error) {
        skippedReasons.readError++;
      }
    }

    event.target.value = '';
    saveState();
    writeAccessLog('import_counts', importSummary(imported, replaced, skippedReasons, adoptedEvent));
    render();
    showToast(importSummary(imported, replaced, skippedReasons, adoptedEvent));
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
    return Boolean(packet
      && packet.schemaVersion === 1
      && ['device-counts', 'final-report'].includes(packet.kind)
      && packet.deviceId
      && packet.event
      && packet.event.date
      && packet.counts);
  }

  function canAdoptImportEvent(packet) {
    return isValidPacket(packet)
      && Object.keys(state.imports).length === 0
      && !hasAnyCount(state.counts)
      && Boolean(packet.event?.date)
      && eventTypes.includes(packet.event?.type);
  }

  function adoptEventFromPacket(packet) {
    state.event = {
      ...state.event,
      name: packet.event.name || state.event.name,
      type: packet.event.type,
      date: packet.event.date,
      local: packet.event.local || state.event.local,
      regionalLeader: packet.event.regionalLeader || state.event.regionalLeader,
      elder: packet.event.elder || state.event.elder,
      region: packet.event.region || state.event.region,
    };
    ensureSelectedGroup();
  }

  function hasAnyCount(counts) {
    const normalized = normalizeCounts(counts);
    return catalog.some((group) => (
      group.items.some(([itemId]) => safeNumber(normalized[group.id][itemId]) > 0)
    ));
  }

  function importSummary(imported, replaced, skippedReasons, adoptedEvent) {
    const skipped = Object.values(skippedReasons).reduce((sum, value) => sum + value, 0);
    const parts = [`${imported} arquivo(s) importado(s)`];

    if (replaced > 0) parts.push(`${replaced} substituido(s)`);
    if (skipped > 0) {
      const reasons = importSkipReasonLabels(skippedReasons);
      parts.push(`${skipped} ignorado(s)${reasons ? `: ${reasons}` : ''}`);
    }
    if (adoptedEvent) {
      parts.push(`evento ajustado para ${formatDate(state.event.date)} - ${state.event.type}`);
    }

    return `${parts.join('. ')}.`;
  }

  function importSkipReasonLabels(reasons) {
    return [
      [reasons.incompatibleDate, 'data diferente'],
      [reasons.incompatibleType, 'tipo diferente'],
      [reasons.sameDevice, 'mesmo aparelho'],
      [reasons.older, 'versao antiga'],
      [reasons.invalid, 'arquivo invalido'],
      [reasons.readError, 'erro de leitura'],
    ]
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}`)
      .join(', ');
  }

  function mergedCounts() {
    const merged = normalizeCounts(state.counts);
    Object.values(state.imports).forEach((packet) => {
      if (!isCompatiblePacket(packet)) return;
      const importedCounts = normalizeCounts(packet.counts);
      catalog.forEach((group) => {
        group.items.forEach(([itemId]) => {
          merged[group.id][itemId] += safeNumber(importedCounts[group.id][itemId]);
        });
      });
    });
    return merged;
  }

  function isCompatiblePacket(packet) {
    return packet?.event?.date === state.event.date
      && packet?.event?.type === state.event.type;
  }

  function groupSubtotal(counts, groupId) {
    const group = catalog.find((item) => item.id === groupId);
    if (!group) return 0;
    return group.items.reduce((sum, [itemId]) => sum + safeNumber(counts?.[groupId]?.[itemId]), 0);
  }

  function calculateTotals(counts, eventType = state.event.type) {
    if (isInstructorMeetingType(eventType)) {
      const totalInstrutores = instrumentGroupIds
        .reduce((sum, groupId) => sum + groupSubtotal(counts, groupId), 0);
      const totalOrganistas = groupSubtotal(counts, 'organistas');
      const totalMinisterioColaboradores =
        groupSubtotal(counts, 'ministerios') + groupSubtotal(counts, 'parte_musical');
      const totalOficializacao = groupSubtotal(counts, 'oficializacao');

      return {
        totalMusicos: totalInstrutores,
        totalOrganistas,
        totalMusicosOrganistas: totalInstrutores + totalOrganistas,
        totalMinisterioColaboradores,
        totalOficializacao,
        totalGeralPresentes: totalInstrutores + totalOrganistas + totalMinisterioColaboradores,
      };
    }

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
