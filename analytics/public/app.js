// ============================================================
// CLÍNICA POLLYANY POLICARPO - APP DO DASHBOARD (JS)
// ============================================================

(function () {
  const API_BASE = window.location.origin;
  let authToken = localStorage.getItem('clinica_analytics_token') || '';
  let timelineChart = null;

  // Estado dos filtros
  const filters = {
    period: 'today',
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    page: 'todas'
  };

  // Elementos do DOM
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password-input');
  const loginError = document.getElementById('login-error');
  const appContainer = document.getElementById('app');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnLogout = document.getElementById('btn-logout');
  const filterPage = document.getElementById('filter-page');
  const filterStart = document.getElementById('filter-start');
  const filterEnd = document.getElementById('filter-end');
  const btnApplyDates = document.getElementById('btn-apply-dates');
  const dateChips = document.querySelectorAll('.date-chip');

  // ─────────────────────────────────────────────────────────────
  // 1. GESTÃO DE AUTENTICAÇÃO
  // ─────────────────────────────────────────────────────────────
  async function checkAuth() {
    if (!authToken) {
      showLogin();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        showApp();
        loadAllData();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    loginModal.style.display = 'flex';
    appContainer.style.display = 'none';
    passwordInput.value = '';
    loginError.style.display = 'none';
  }

  function showApp() {
    loginModal.style.display = 'none';
    appContainer.style.display = 'flex';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) return;

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        authToken = data.token;
        localStorage.setItem('clinica_analytics_token', authToken);
        showApp();
        loadAllData();
      } else {
        loginError.textContent = data.error || 'Senha incorreta. Tente novamente.';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Erro ao conectar ao servidor.';
      loginError.style.display = 'block';
    }
  });

  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('clinica_analytics_token');
    authToken = '';
    showLogin();
  });

  btnRefresh.addEventListener('click', () => {
    loadAllData();
  });

  // ─────────────────────────────────────────────────────────────
  // 2. CONTROLE DE FILTROS DE DATA E PÁGINA
  // ─────────────────────────────────────────────────────────────
  function getTodayDateString() {
    return new Date().toISOString().slice(0, 10);
  }

  function setPeriod(period) {
    filters.period = period;
    const now = new Date();

    if (period === 'today') {
      filters.startDate = getTodayDateString();
      filters.endDate = getTodayDateString();
    } else if (period === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const str = y.toISOString().slice(0, 10);
      filters.startDate = str;
      filters.endDate = str;
    } else if (period === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      filters.startDate = d.toISOString().slice(0, 10);
      filters.endDate = getTodayDateString();
    } else if (period === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      filters.startDate = d.toISOString().slice(0, 10);
      filters.endDate = getTodayDateString();
    } else if (period === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      filters.startDate = firstDay.toISOString().slice(0, 10);
      filters.endDate = getTodayDateString();
    }

    filterStart.value = filters.startDate;
    filterEnd.value = filters.endDate;

    dateChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.period === period);
    });

    loadAllData();
  }

  dateChips.forEach(chip => {
    chip.addEventListener('click', () => {
      setPeriod(chip.dataset.period);
    });
  });

  btnApplyDates.addEventListener('click', () => {
    if (filterStart.value && filterEnd.value) {
      filters.period = 'custom';
      filters.startDate = filterStart.value;
      filters.endDate = filterEnd.value;
      dateChips.forEach(chip => chip.classList.remove('active'));
      loadAllData();
    }
  });

  filterPage.addEventListener('change', () => {
    filters.page = filterPage.value;
    loadAllData();
  });

  // ─────────────────────────────────────────────────────────────
  // 3. CARREGAMENTO GERAL DE DADOS
  // ─────────────────────────────────────────────────────────────
  function getQueryString() {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.page && filters.page !== 'todas') params.set('page', filters.page);
    return params.toString();
  }

  async function apiFetch(endpoint) {
    const qs = getQueryString();
    const url = `${API_BASE}${endpoint}${qs ? '?' + qs : ''}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.status === 401) {
      showLogin();
      throw new Error('Sessão expirada');
    }
    return res.json();
  }

  async function loadAllData() {
    try {
      await Promise.all([
        loadOverview(),
        loadPages(),
        loadButtons(),
        loadVideos(),
        loadTimeline()
      ]);
    } catch (e) {
      console.error('[Dashboard Load Error]', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. KPIS DE VISÃO GERAL
  // ─────────────────────────────────────────────────────────────
  async function loadOverview() {
    const data = await apiFetch('/api/stats/overview');
    document.getElementById('kpi-visitors').textContent = data.visitors.toLocaleString();
    document.getElementById('kpi-views').textContent = data.pageviews.toLocaleString();
    document.getElementById('kpi-time').textContent = formatSeconds(data.avgDuration);
    document.getElementById('kpi-clicks').textContent = data.clicks.toLocaleString();
    document.getElementById('kpi-ctr').textContent = `${data.ctrGlobal}%`;
    document.getElementById('kpi-video-rate').textContent = `${data.videoCompletionRate}%`;
    document.getElementById('kpi-video-completions').textContent = data.videoCompletions.toLocaleString();
  }

  function formatSeconds(secs) {
    if (!secs || secs <= 0) return '0s';
    if (secs < 60) return `${secs}s`;
    const min = Math.floor(secs / 60);
    const s = secs % 60;
    return `${min}m ${s}s`;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. DESEMPENHO POR PÁGINA
  // ─────────────────────────────────────────────────────────────
  async function loadPages() {
    const rows = await apiFetch('/api/stats/pages');
    const tbody = document.getElementById('pages-table-body');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum acesso registrado no período selecionado.</td></tr>';
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${r.name}</strong></td>
        <td>${r.visitors.toLocaleString()}</td>
        <td>${r.pageviews.toLocaleString()}</td>
        <td>${formatSeconds(r.avgTime)}</td>
        <td>${r.clicks.toLocaleString()}</td>
        <td><span class="badge ${parseFloat(r.ctr) > 20 ? 'badge-green' : 'badge-gold'}">${r.ctr}% CTR</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 6. RANKING DE BOTÕES MAIS E MENOS CLICADOS
  // ─────────────────────────────────────────────────────────────
  async function loadButtons() {
    const data = await apiFetch('/api/stats/buttons');
    const tbody = document.getElementById('buttons-table-body');
    tbody.innerHTML = '';

    const list = data.buttons || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhum clique registrado no período selecionado.</td></tr>';
      return;
    }

    const maxClicks = list[0].total_clicks || 1;

    list.forEach((b, index) => {
      let badgeClass = 'badge-gray';
      let badgeText = 'Moderado';

      if (index === 0) {
        badgeClass = 'badge-gold';
        badgeText = '★ Mais Clicado';
      } else if (index < 3) {
        badgeClass = 'badge-green';
        badgeText = 'Alta Demanda';
      } else if (b.total_clicks <= 2) {
        badgeClass = 'badge-gray';
        badgeText = 'Menos Clicado';
      }

      const label = b.target_text || b.target_id || 'Botão sem texto';
      const pageName = b.page_category === 'principal' ? 'Árvore Principal' :
                       b.page_category === 'implante' ? 'Implantes' :
                       b.page_category === 'preenchimento' ? 'Preenchimento' : b.page_category;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #FFF;">${label}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${b.target_local || 'geral'}</div>
        </td>
        <td>${pageName}</td>
        <td><strong>${b.total_clicks.toLocaleString()}</strong></td>
        <td>${b.unique_clickers.toLocaleString()}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 7. ANÁLISE DE VÍDEOS & FUNIL
  // ─────────────────────────────────────────────────────────────
  async function loadVideos() {
    const data = await apiFetch('/api/stats/videos');
    const f = data.funnel || { plays: 0, m25: 0, m50: 0, m75: 0, completed: 0 };
    const totalPlays = f.plays || 0;

    document.getElementById('video-plays-val').textContent = totalPlays.toLocaleString();
    document.getElementById('video-duration-val').textContent = formatSeconds(data.avgWatchTime);
    document.getElementById('video-full-val').textContent = f.completed.toLocaleString();

    const p25 = totalPlays > 0 ? Math.round((f.m25 / totalPlays) * 100) : 0;
    const p50 = totalPlays > 0 ? Math.round((f.m50 / totalPlays) * 100) : 0;
    const p75 = totalPlays > 0 ? Math.round((f.m75 / totalPlays) * 100) : 0;
    const p100 = totalPlays > 0 ? Math.round((f.completed / totalPlays) * 100) : 0;

    document.getElementById('funnel-play-pct').textContent = totalPlays > 0 ? `${totalPlays} plays (100%)` : '0';
    document.getElementById('funnel-25-pct').textContent = `${f.m25} (${p25}%)`;
    document.getElementById('funnel-50-pct').textContent = `${f.m50} (${p50}%)`;
    document.getElementById('funnel-75-pct').textContent = `${f.m75} (${p75}%)`;
    document.getElementById('funnel-100-pct').textContent = `${f.completed} (${p100}%)`;

    document.getElementById('bar-play').style.width = totalPlays > 0 ? '100%' : '0%';
    document.getElementById('bar-25').style.width = `${p25}%`;
    document.getElementById('bar-50').style.width = `${p50}%`;
    document.getElementById('bar-75').style.width = `${p75}%`;
    document.getElementById('bar-100').style.width = `${p100}%`;

    // Cruzamento de conversão
    const cross = data.crossConversion || {};
    document.getElementById('cross-completed-rate').textContent = `${cross.completedRate || 0}%`;
    document.getElementById('cross-dropped-rate').textContent = `${cross.droppedRate || 0}%`;
  }

  // ─────────────────────────────────────────────────────────────
  // 8. GRÁFICO DE LINHA DO TEMPO (Chart.js)
  // ─────────────────────────────────────────────────────────────
  async function loadTimeline() {
    const rows = await apiFetch('/api/stats/timeline');
    const ctx = document.getElementById('timelineChart').getContext('2d');

    const labels = rows.map(r => {
      const parts = r.created_date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });
    const visitorsData = rows.map(r => r.visitors);
    const clicksData = rows.map(r => r.clicks);

    if (timelineChart) {
      timelineChart.destroy();
    }

    timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['Sem dados'],
        datasets: [
          {
            label: 'Visitantes Únicos',
            data: visitorsData.length ? visitorsData : [0],
            borderColor: '#DCC397',
            backgroundColor: 'rgba(220, 195, 151, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#F5E5C9',
            pointRadius: 4
          },
          {
            label: 'Cliques em Ações (CTAs)',
            data: clicksData.length ? clicksData : [0],
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.08)',
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#4ade80',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            labels: {
              color: '#DCC397',
              font: { family: 'Outfit', size: 12, weight: '600' }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: 'rgba(255, 255, 255, 0.55)', font: { family: 'Outfit' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: 'rgba(255, 255, 255, 0.55)', font: { family: 'Outfit', precision: 0 } }
          }
        }
      }
    });
  }

  // Inicialização
  filterStart.value = filters.startDate;
  filterEnd.value = filters.endDate;
  checkAuth();
})();
