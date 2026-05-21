(function () {
  'use strict';

  const STORAGE_KEY = 'contador-musicos-web-v1';
  const AUTH_SESSION_KEY = 'contador-musicos-auth-v1';
  const ACCESS_LOG_KEY = 'contador-musicos-access-logs-v1';
  const USER_STORAGE_KEY = 'contador-musicos-users-v1';
  const DEFAULT_USER_ACCOUNTS = [
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
  ];
  const instrumentGroupIds = ['cordas', 'teclas', 'madeiras', 'metais'];

  let state = loadState();
  let currentUser = loadSession();

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindAuth();
    bindTabs();
    bindActions();
    bindInputs();
    bindUserManagement();
    renderAuth();
    if (currentUser) render();
    registerServiceWorker();
  }

  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.tab === 'admin' && !isAdmin()) {
          writeAccessLog('access_denied', 'Tentativa de abrir administração');
          showToast('Acesso permitido apenas para administrador.');
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
    document.getElementById('loginUser').addEventListener('input', renderLoginGroupRequirement);
    document.getElementById('loginUser').addEventListener('change', renderLoginGroupRequirement);

    document.getElementById('loginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const username = normalizeUsername(document.getElementById('loginUser').value);
      const password = document.getElementById('loginPassword').value;
      const account = readUserAccounts().find((user) => (
        user.username === username && user.password === password
      ));

      if (!account) {
        document.getElementById('loginError').textContent = 'Usuário ou senha inválidos.';
        writeAccessLog('login_failed', username || 'sem usuario');
        return;
      }

      const countGroup = account.role === 'contador'
        ? document.getElementById('loginCountGroup').value
        : '';

      if (account.role === 'contador' && !instrumentGroupIds.includes(countGroup)) {
        document.getElementById('loginError').textContent = 'Selecione o grupo para contagem.';
        return;
      }

      currentUser = {
        username: account.username,
        name: account.name,
        role: account.role,
        countGroup,
        loginAt: new Date().toISOString(),
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
      if (currentUser.countGroup) {
        state.selectedGroup = currentUser.countGroup;
        saveState();
      }
      document.getElementById('loginError').textContent = '';
      writeAccessLog('login_success', currentUser.countGroup
        ? `Entrada no sistema | Grupo: ${groupLabel(currentUser.countGroup)}`
        : 'Entrada no sistema');
      renderAuth();
      render();
    });
  }

  function renderLoginGroupRequirement() {
    const username = normalizeUsername(document.getElementById('loginUser').value);
    const account = readUserAccounts().find((user) => user.username === username);
    const isCounter = account?.role === 'contador';
    document.getElementById('loginGroupField').classList.toggle('is-hidden', !isCounter);
    document.getElementById('loginCountGroup').required = isCounter;
  }

  function bindActions() {
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'save') {
          saveState();
          writeAccessLog('save', 'Dados salvos');
          showToast('Dados salvos neste aparelho.');
        }
        if (action === 'print') {
          state.activeTab = 'report';
          saveState();
          writeAccessLog('print_report', 'Relatório enviado para impressão/PDF');
          render();
          window.setTimeout(() => window.print(), 80);
        }
        if (action === 'export') exportDeviceCounts();
        if (action === 'export-final') exportFinalReport();
        if (action === 'logout') logout();
        if (action === 'export-logs') exportAccessLogs();
        if (action === 'clear-logs') clearAccessLogs();
        if (action === 'clear-imports') {
          state.imports = {};
          saveState();
          writeAccessLog('clear_imports', 'Importações removidas');
          render();
          showToast('Importações removidas.');
        }
      });
    });

    document.getElementById('importFiles').addEventListener('change', importFiles);
  }

  function bindUserManagement() {
    document.getElementById('userForm').addEventListener('submit', (event) => {
      event.preventDefault();
      saveUserFromForm();
    });

    document.getElementById('cancelUserEdit').addEventListener('click', resetUserForm);

    document.getElementById('userTableBody').addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-action]');
      if (!button) return;

      const username = button.dataset.username;
      if (button.dataset.userAction === 'edit') editUser(username);
      if (button.dataset.userAction === 'reset-password') resetUserPassword(username);
      if (button.dataset.userAction === 'delete') deleteUser(username);
    });
  }

  function readUserAccounts() {
    try {
      const stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '[]');
      if (!Array.isArray(stored) || stored.length === 0) {
        saveUserAccounts(DEFAULT_USER_ACCOUNTS);
        return [...DEFAULT_USER_ACCOUNTS];
      }

      const normalized = stored
        .filter((user) => user?.username && user?.password && user?.role)
        .map((user) => ({
          username: normalizeUsername(user.username),
          password: String(user.password),
          name: String(user.name || user.username),
          role: normalizeRole(user.role),
        }));

      if (!normalized.some((user) => user.role === 'administrador')) {
        normalized.unshift(DEFAULT_USER_ACCOUNTS[0]);
      }

      return uniqueUsers(normalized);
    } catch (error) {
      saveUserAccounts(DEFAULT_USER_ACCOUNTS);
      return [...DEFAULT_USER_ACCOUNTS];
    }
  }

  function saveUserAccounts(users) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(uniqueUsers(users)));
  }

  function uniqueUsers(users) {
    const byUsername = new Map();
    users.forEach((user) => {
      byUsername.set(normalizeUsername(user.username), {
        username: normalizeUsername(user.username),
        password: String(user.password),
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
    return role === 'administrador' ? 'administrador' : 'contador';
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);
      const account = readUserAccounts().find((user) => user.username === session.username);
      if (!account) return null;

      return {
        username: account.username,
        name: account.name,
        role: account.role,
        countGroup: account.role === 'contador'
          ? (instrumentGroupIds.includes(session.countGroup) ? session.countGroup : instrumentGroupIds[0])
          : '',
        loginAt: session.loginAt || new Date().toISOString(),
      };
    } catch (error) {
      return null;
    }
  }

  function logout() {
    writeAccessLog('logout', 'Saída do sistema');
    localStorage.removeItem(AUTH_SESSION_KEY);
    currentUser = null;
    renderAuth();
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

    document.getElementById('currentUserChip').textContent = currentUser.countGroup
      ? `${currentUser.name} | ${currentUser.role} | ${groupLabel(currentUser.countGroup)}`
      : `${currentUser.name} | ${currentUser.role}`;

    document.querySelectorAll('.admin-only').forEach((element) => {
      element.classList.toggle('is-hidden', !isAdmin());
    });

    if (!isAdmin() && state.activeTab === 'admin') {
      state.activeTab = 'event';
      saveState();
    }
  }

  function isAdmin() {
    return currentUser?.role === 'administrador';
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

  function saveUserFromForm() {
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

    const users = readUserAccounts();
    const existing = users.find((user) => user.username === (editKey || username));
    const duplicate = users.some((user) => user.username === username && user.username !== editKey);

    if (duplicate) {
      showToast('Já existe um usuário com este login.');
      return;
    }

    if (!existing && !password) {
      showToast('Informe uma senha para o novo usuário.');
      return;
    }

    const nextUsers = users.filter((user) => user.username !== editKey && user.username !== username);
    nextUsers.push({
      username,
      name,
      password: password || existing?.password || '',
      role,
    });

    if (!nextUsers.some((user) => user.role === 'administrador')) {
      showToast('É necessário manter pelo menos um administrador.');
      return;
    }

    saveUserAccounts(nextUsers);

    if (currentUser?.username === editKey || currentUser?.username === username) {
      const updatedCurrentUser = readUserAccounts().find((user) => user.username === username);
      currentUser = {
        username: updatedCurrentUser.username,
        name: updatedCurrentUser.name,
        role: updatedCurrentUser.role,
        countGroup: updatedCurrentUser.role === 'contador'
          ? (currentUser.countGroup || instrumentGroupIds[0])
          : '',
        loginAt: currentUser.loginAt,
      };
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
    }

    writeAccessLog(existing ? 'update_user' : 'create_user', username);
    resetUserForm();
    render();
    showToast(existing ? 'Usuário atualizado.' : 'Usuário criado.');
  }

  function editUser(username) {
    if (!isAdmin()) return;

    const user = readUserAccounts().find((item) => item.username === username);
    if (!user) return;

    document.getElementById('userEditKey').value = user.username;
    document.getElementById('userName').value = user.name;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Deixe em branco para manter';
    document.getElementById('userRole').value = user.role;
  }

  function deleteUser(username) {
    if (!isAdmin()) return;

    if (username === currentUser.username) {
      showToast('Não é possível excluir o usuário logado.');
      return;
    }

    const users = readUserAccounts();
    const user = users.find((item) => item.username === username);
    if (!user) return;

    const nextUsers = users.filter((item) => item.username !== username);
    if (!nextUsers.some((item) => item.role === 'administrador')) {
      showToast('É necessário manter pelo menos um administrador.');
      return;
    }

    const confirmation = window.confirm(`Deseja excluir o usuário ${user.name}?`);
    if (!confirmation) return;

    saveUserAccounts(nextUsers);
    writeAccessLog('delete_user', username);
    resetUserForm();
    render();
    showToast('Usuário excluído.');
  }

  function resetUserPassword(username) {
    if (!isAdmin()) return;

    const users = readUserAccounts();
    const user = users.find((item) => item.username === username);
    if (!user) return;

    const newPassword = window.prompt(`Informe a nova senha para ${user.name}:`);
    if (newPassword === null) return;

    if (newPassword.trim().length < 4) {
      showToast('A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }

    const updatedUsers = users.map((item) => (
      item.username === username
        ? {...item, password: newPassword.trim()}
        : item
    ));
    saveUserAccounts(updatedUsers);
    writeAccessLog('reset_password', username);
    render();
    showToast('Senha redefinida.');
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
      activeTab: 'event',
      selectedGroup: 'cordas',
      event: {
        name: 'Contagem de Músicos e Organistas',
        type: 'Reunião de encarregados e instrutores',
        date: today(),
        local: '',
        regionalLeader: '',
        elder: '',
        region: '',
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
      activeTab: ['event', 'count', 'sync', 'report', 'admin'].includes(raw.activeTab)
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
    if (!currentUser) return;
    renderAuth();
    renderTabs();
    renderInputs();
    ensureSelectedGroup();
    renderGroups();
    renderCounters();
    renderSummary();
    renderImports();
    renderReport();
    renderAdmin();
  }

  function renderTabs() {
    if (!isAdmin() && state.activeTab === 'admin') {
      state.activeTab = 'event';
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
    if (isInstructorMeetingType(eventType)) {
      return catalog.filter((group) => instrumentGroupIds.includes(group.id));
    }

    return catalog;
  }

  function activeCatalog() {
    return catalogForEventType(state.event.type);
  }

  function countCatalog() {
    const availableGroups = activeCatalog();
    if (currentUser?.role !== 'contador') return availableGroups;

    return availableGroups.filter((group) => group.id === currentUser.countGroup);
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

  function itemLabelForCurrentEvent(label) {
    if (isInstructorMeetingType(state.event.type)) {
      return `Instrutores - ${label}`;
    }

    return label;
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
          <div class="counter-label">${escapeHtml(itemLabelForCurrentEvent(label))}</div>
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
      .filter((packet) => isCompatiblePacket(packet))
      .sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)));
    const list = document.getElementById('importList');

    if (imports.length === 0) {
      list.innerHTML = '<p class="muted">Nenhum celular importado ainda.</p>';
      return;
    }

    list.innerHTML = imports.map((packet) => {
      const totals = calculateTotals(normalizeCounts(packet.counts), packet.event?.type);
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
      ['Aparelhos importados', String(Object.keys(state.imports).length)],
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
    const users = readUserAccounts()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    document.getElementById('userTableBody').innerHTML = users.map((user) => {
      const isCurrent = currentUser?.username === user.username;
      return `
        <tr>
          <td>${escapeHtml(user.name)}${isCurrent ? ' <strong>(logado)</strong>' : ''}</td>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(roleLabel(user.role))}</td>
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
    return role === 'administrador' ? 'Administrador' : 'Contador';
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
      import_counts: 'Importou contagens',
      login_failed: 'Falha de login',
      login_success: 'Login',
      logout: 'Logout',
      open_tab: 'Abriu tela',
      print_report: 'Imprimiu relatório',
      reset_password: 'Resetou senha',
      save: 'Salvou dados',
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
          <td>${escapeHtml(itemLabelForCurrentEvent(label))}</td>
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
    let skipped = 0;
    for (const file of files) {
      try {
        const packet = JSON.parse(await file.text());
        if (!isValidPacket(packet)) {
          skipped++;
          continue;
        }
        if (!isCompatiblePacket(packet)) {
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
    writeAccessLog('import_counts', `${imported} arquivo(s) importado(s), ${skipped} ignorado(s)`);
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

      return {
        totalMusicos: totalInstrutores,
        totalOrganistas: 0,
        totalMusicosOrganistas: totalInstrutores,
        totalMinisterioColaboradores: 0,
        totalOficializacao: 0,
        totalGeralPresentes: totalInstrutores,
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
