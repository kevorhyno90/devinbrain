// Devin BrainJet - Main App Logic
const App = (() => {
  let state = {
    plans: [],
    currentView: 'dashboard',
    calMonth: new Date().getMonth(),
    calYear: new Date().getFullYear(),
    filter: { category: 'all', status: 'all', search: '' },
    editingPlan: null,
    aiOnline: false,
    soundOn: true,
    reminderCheckInterval: null,
    deferredInstall: null
  };

  // ===== Init =====
  async function init() {
    await DB.open();
    state.plans = await DB.getAllPlans();
    state.aiOnline = (await DB.getSetting('aiOnline', false)) === true;
    state.soundOn = (await DB.getSetting('soundOn', true)) !== false;

    bindEvents();
    registerSW();
    setupInstallPrompt();
    await requestNotifPermission();
    renderAll();
    startReminderLoop();
    handleUrlParams();

    // Show install banner if not installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      document.body.classList.add('installed');
    }

    // Greet user on first visit
    const visited = await DB.getSetting('visited', false);
    if (!visited) {
      await DB.setSetting('visited', true);
      setTimeout(() => {
        toast('Welcome to Devin BrainJet! 🌅 Click the AI button (bottom-right) to chat with Jet.', 'success', 6000);
      }, 800);
      // Add sample plans
      if (state.plans.length === 0) await seedSamples();
    }
  }

  async function seedSamples() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    const samples = [
      { title: 'Morning prayer & reflection', category: 'mind', priority: 'medium', dueDate: tomorrow.toISOString().slice(0,16), notes: 'Start the day grounded.', reminder: 30, status: 'pending' },
      { title: 'Feed livestock & check water', category: 'farm', priority: 'high', dueDate: tomorrow.toISOString().slice(0,16), notes: 'Cattle, chickens, goats.', reminder: 60, status: 'pending' },
      { title: 'Family dinner — no phones', category: 'task', priority: 'high', dueDate: tomorrow.toISOString().slice(0,16), notes: 'Quality time with wife & kids.', reminder: 30, status: 'pending' },
      { title: 'Plan next month farm rotation', category: 'farm', priority: 'medium', dueDate: nextWeek.toISOString().slice(0,16), notes: 'Crop planning + soil prep.', reminder: 1440, status: 'pending' }
    ];
    for (const s of samples) await DB.savePlan(s);
    state.plans = await DB.getAllPlans();
  }

  // ===== Service Worker =====
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('SW registered'))
        .catch(e => console.warn('SW failed:', e));
    }
  }

  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstall = e;
      document.getElementById('installBanner')?.classList.add('show');
    });
    window.addEventListener('appinstalled', () => {
      toast('🎉 BrainJet installed! Find it on your home screen.', 'success');
      document.getElementById('installBanner')?.classList.remove('show');
    });
  }

  async function triggerInstall() {
    if (!state.deferredInstall) {
      toast('Install: in Chrome menu → "Install app". In Safari → Share → "Add to Home Screen".', 'warning', 6000);
      return;
    }
    state.deferredInstall.prompt();
    const choice = await state.deferredInstall.userChoice;
    if (choice.outcome === 'accepted') toast('Installing… 📲', 'success');
    state.deferredInstall = null;
    document.getElementById('installBanner')?.classList.remove('show');
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {}
    }
  }

  // ===== URL params =====
  function handleUrlParams() {
    const p = new URLSearchParams(location.search);
    if (p.get('action') === 'new-task') openPlanModal();
    if (p.get('view')) switchView(p.get('view'));
  }

  // ===== Events =====
  function bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => switchView(el.dataset.view));
    });

    // Mobile sidebar
    document.getElementById('hamburger')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('show');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('show');
    });

    // Add plan
    document.getElementById('addPlanBtn')?.addEventListener('click', () => openPlanModal());
    document.getElementById('quickAddBtn')?.addEventListener('click', () => openPlanModal());

    // Plan form
    document.getElementById('planForm')?.addEventListener('submit', savePlanForm);
    document.getElementById('modalClose')?.addEventListener('click', closePlanModal);
    document.getElementById('cancelBtn')?.addEventListener('click', closePlanModal);
    document.getElementById('modalBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') closePlanModal();
    });

    // Filters
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.addEventListener('click', () => {
        const group = el.dataset.group;
        document.querySelectorAll(`.filter-chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        state.filter[group] = el.dataset.value;
        renderPlans();
      });
    });

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      state.filter.search = e.target.value.toLowerCase();
      renderPlans();
    });

    // Calendar navigation
    document.getElementById('calPrev')?.addEventListener('click', () => {
      if (state.calMonth === 0) { state.calMonth = 11; state.calYear--; }
      else state.calMonth--;
      renderCalendar();
    });
    document.getElementById('calNext')?.addEventListener('click', () => {
      if (state.calMonth === 11) { state.calMonth = 0; state.calYear++; }
      else state.calMonth++;
      renderCalendar();
    });
    document.getElementById('calToday')?.addEventListener('click', () => {
      const n = new Date();
      state.calMonth = n.getMonth(); state.calYear = n.getFullYear();
      renderCalendar();
    });

    // PDF Report
    document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
      PDFReport.generate(state.plans);
      toast('📄 PDF report downloaded!', 'success');
    });

    // Export/Import
    document.getElementById('exportBtn')?.addEventListener('click', exportData);
    document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile')?.addEventListener('change', importData);
    document.getElementById('clearBtn')?.addEventListener('click', clearAllData);

    // Install
    document.getElementById('installBtn')?.addEventListener('click', triggerInstall);
    document.getElementById('installBannerBtn')?.addEventListener('click', triggerInstall);

    // Settings
    document.getElementById('aiOnlineToggle')?.addEventListener('change', async (e) => {
      state.aiOnline = e.target.checked;
      await DB.setSetting('aiOnline', state.aiOnline);
      toast(state.aiOnline ? '🌐 Online AI boost enabled' : '📴 Offline AI only', 'success');
    });
    document.getElementById('soundToggle')?.addEventListener('change', async (e) => {
      state.soundOn = e.target.checked;
      await DB.setSetting('soundOn', state.soundOn);
    });

    // AI Chat
    document.getElementById('aiFab')?.addEventListener('click', toggleAI);
    document.getElementById('aiSend')?.addEventListener('click', sendAI);
    document.getElementById('aiInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendAI();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openPlanModal(); }
      if (e.key === '/') { e.preventDefault(); document.getElementById('searchInput')?.focus(); }
      if (e.key === 'Escape') closePlanModal();
    });

    // Online/offline detection
    window.addEventListener('online', () => toast('🌐 You are back online!', 'success'));
    window.addEventListener('offline', () => toast('📴 Offline mode — your data is safe.', 'warning'));
  }

  // ===== View switching =====
  function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === 'view-' + view);
    });
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    renderAll();
  }

  // ===== Render =====
  function renderAll() {
    renderTopbar();
    if (state.currentView === 'dashboard') renderDashboard();
    if (state.currentView === 'plans') renderPlans();
    if (state.currentView === 'calendar') renderCalendar();
    if (state.currentView === 'reports') renderReports();
    renderReminderBanner();
  }

  function renderTopbar() {
    const titles = {
      dashboard: '📊 Dashboard',
      plans: '📋 All Plans',
      calendar: '📅 Calendar',
      reports: '📈 Reports',
      settings: '⚙️ Settings'
    };
    document.getElementById('viewTitle').textContent = titles[state.currentView] || 'BrainJet';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('topMeta').textContent = today;
  }

  function renderReminderBanner() {
    const banner = document.getElementById('reminderBanner');
    if (!banner) return;
    const overdue = state.plans.filter(p => p.status !== 'done' && isOverdue(p.dueDate));
    const dueSoon = state.plans.filter(p => p.status !== 'done' && isDueSoon(p.dueDate, 60));

    if (overdue.length > 0) {
      banner.innerHTML = `
        <div class="reminder-banner-icon">⚠️</div>
        <div class="reminder-banner-text">
          <strong>${overdue.length}</strong> overdue ${overdue.length === 1 ? 'task' : 'tasks'} need attention!
          ${dueSoon.length ? `Also ${dueSoon.length} due in next hour.` : ''}
        </div>
        <button class="btn btn-sm btn-ghost" onclick="App.switchView('plans')">View</button>
      `;
      banner.style.display = 'flex';
    } else if (dueSoon.length > 0) {
      banner.style.background = 'linear-gradient(135deg, #ffc857, #f7931e)';
      banner.style.animation = 'none';
      banner.innerHTML = `
        <div class="reminder-banner-icon">⏰</div>
        <div class="reminder-banner-text">
          <strong>${dueSoon.length}</strong> ${dueSoon.length === 1 ? 'task' : 'tasks'} due within the hour
        </div>
        <button class="btn btn-sm btn-ghost" onclick="App.switchView('plans')">View</button>
      `;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  // ===== Dashboard =====
  function renderDashboard() {
    const total = state.plans.length;
    const done = state.plans.filter(p => p.status === 'done').length;
    const pending = total - done;
    const overdue = state.plans.filter(p => p.status !== 'done' && isOverdue(p.dueDate)).length;
    const today = state.plans.filter(p => p.status !== 'done' && isToday(p.dueDate)).length;
    const thisWeek = state.plans.filter(p => p.status !== 'done' && isThisWeek(p.dueDate)).length;
    const completionRate = total ? Math.round(done / total * 100) : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statOverdue').textContent = overdue;
    document.getElementById('statToday').textContent = today;
    document.getElementById('statWeek').textContent = thisWeek;
    document.getElementById('statRate').textContent = completionRate + '%';

    // Category counts
    const mind = state.plans.filter(p => p.category === 'mind').length;
    const farm = state.plans.filter(p => p.category === 'farm').length;
    const task = state.plans.filter(p => p.category === 'task').length;
    document.getElementById('statMind').textContent = mind;
    document.getElementById('statFarm').textContent = farm;
    document.getElementById('statTask').textContent = task;

    // Today's plans list
    const todayPlans = state.plans
      .filter(p => p.status !== 'done' && (isToday(p.dueDate) || isOverdue(p.dueDate)))
      .sort((a,b) => priorityWeight(b.priority) - priorityWeight(a.priority))
      .slice(0, 6);

    const tEl = document.getElementById('dashTodayList');
    if (tEl) {
      if (todayPlans.length === 0) {
        tEl.innerHTML = '<div class="empty"><div class="empty-icon">🎉</div><div class="empty-title">All clear for today!</div><div>Great job. Enjoy the moment.</div></div>';
      } else {
        tEl.innerHTML = todayPlans.map(p => planItemHTML(p)).join('');
        attachPlanHandlers(tEl);
      }
    }

    // Upcoming
    const upcoming = state.plans
      .filter(p => p.status !== 'done' && p.dueDate && !isToday(p.dueDate) && !isOverdue(p.dueDate))
      .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);
    const uEl = document.getElementById('dashUpcomingList');
    if (uEl) {
      if (upcoming.length === 0) {
        uEl.innerHTML = '<div class="empty"><div class="empty-icon">🗓️</div><div>No upcoming plans</div></div>';
      } else {
        uEl.innerHTML = upcoming.map(p => planItemHTML(p)).join('');
        attachPlanHandlers(uEl);
      }
    }

    // Chart
    renderChart();
  }

  let chartInstance = null;
  function renderChart() {
    const canvas = document.getElementById('progressChart');
    if (!canvas || !window.Chart) return;
    const mind = { total: 0, done: 0 };
    const farm = { total: 0, done: 0 };
    const task = { total: 0, done: 0 };
    state.plans.forEach(p => {
      const c = p.category === 'mind' ? mind : p.category === 'farm' ? farm : task;
      c.total++;
      if (p.status === 'done') c.done++;
    });

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Mind', 'Farm', 'Task'],
        datasets: [{
          data: [mind.total, farm.total, task.total],
          backgroundColor: ['#9b5de5', '#06d6a0', '#ff6b35'],
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#fff3e0', font: { size: 12, weight: 'bold' }, padding: 14 } }
        },
        cutout: '60%'
      }
    });
  }

  // ===== Plans list =====
  function renderPlans() {
    const list = document.getElementById('plansList');
    if (!list) return;

    let filtered = [...state.plans];

    if (state.filter.category !== 'all') filtered = filtered.filter(p => p.category === state.filter.category);
    if (state.filter.status === 'pending') filtered = filtered.filter(p => p.status !== 'done');
    else if (state.filter.status === 'done') filtered = filtered.filter(p => p.status === 'done');
    else if (state.filter.status === 'overdue') filtered = filtered.filter(p => p.status !== 'done' && isOverdue(p.dueDate));
    else if (state.filter.status === 'today') filtered = filtered.filter(p => isToday(p.dueDate));
    if (state.filter.search) filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(state.filter.search) ||
      (p.notes || '').toLowerCase().includes(state.filter.search)
    );

    filtered.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      return new Date(a.dueDate || '9999') - new Date(b.dueDate || '9999');
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No plans match your filter</div>
        <div>Try changing filters or add a new plan.</div>
      </div>`;
      return;
    }

    list.innerHTML = filtered.map(p => planItemHTML(p)).join('');
    attachPlanHandlers(list);
  }

  function planItemHTML(p) {
    const overdue = p.status !== 'done' && isOverdue(p.dueDate);
    const done = p.status === 'done';
    const due = p.dueDate ? new Date(p.dueDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'No date';
    return `
      <div class="plan-item ${p.category} ${done ? 'done' : ''} ${overdue ? 'overdue' : ''}" data-id="${p.id}">
        <div class="plan-check ${done ? 'checked' : ''}" data-action="toggle" data-id="${p.id}">${done ? '✓' : ''}</div>
        <div class="plan-content">
          <div class="plan-title">${escape(p.title)}</div>
          <div class="plan-meta">
            <span class="badge ${p.category}">${p.category}</span>
            <span class="badge ${p.priority}">${p.priority}</span>
            <span>📅 ${due}</span>
            ${p.reminder ? `<span>🔔 ${p.reminder}m before</span>` : ''}
          </div>
          ${p.notes ? `<div style="margin-top:8px;font-size:12.5px;color:var(--text-dim);">${escape(p.notes)}</div>` : ''}
        </div>
        <div class="plan-actions">
          <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Edit">✏️</button>
          <button class="icon-btn" data-action="delete" data-id="${p.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  function attachPlanHandlers(container) {
    container.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const action = el.dataset.action;
        if (action === 'toggle') togglePlan(id);
        else if (action === 'edit') editPlan(id);
        else if (action === 'delete') deletePlan(id);
      });
    });
  }

  async function togglePlan(id) {
    const p = state.plans.find(x => x.id === id);
    if (!p) return;
    p.status = p.status === 'done' ? 'pending' : 'done';
    if (p.status === 'done') {
      p.completedAt = new Date().toISOString();
      playSound('ding');
      toast('✅ Task completed! Great work!', 'success');
    }
    await DB.savePlan(p);
    state.plans = await DB.getAllPlans();
    renderAll();
  }

  async function deletePlan(id) {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    await DB.deletePlan(id);
    state.plans = await DB.getAllPlans();
    renderAll();
    toast('🗑️ Plan deleted', 'warning');
  }

  function editPlan(id) {
    const p = state.plans.find(x => x.id === id);
    if (p) openPlanModal(p);
  }

  // ===== Modal =====
  function openPlanModal(plan = null) {
    state.editingPlan = plan;
    const modal = document.getElementById('modalBackdrop');
    const form = document.getElementById('planForm');
    document.getElementById('modalTitle').textContent = plan ? 'Edit Plan' : 'New Plan';
    if (plan) {
      form.title.value = plan.title || '';
      form.category.value = plan.category || 'task';
      form.priority.value = plan.priority || 'medium';
      form.dueDate.value = plan.dueDate ? plan.dueDate.slice(0, 16) : '';
      form.reminder.value = plan.reminder || 0;
      form.notes.value = plan.notes || '';
      form.recurring.value = plan.recurring || 'none';
    } else {
      form.reset();
      // Default due date = tomorrow 9am
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      form.dueDate.value = t.toISOString().slice(0, 16);
      form.reminder.value = 30;
      form.priority.value = 'medium';
      form.category.value = 'task';
    }
    modal.classList.add('show');
    setTimeout(() => form.title.focus(), 100);
  }

  function closePlanModal() {
    document.getElementById('modalBackdrop').classList.remove('show');
    state.editingPlan = null;
  }

  async function savePlanForm(e) {
    e.preventDefault();
    const form = e.target;
    const plan = state.editingPlan ? { ...state.editingPlan } : { status: 'pending', notified: {} };
    plan.title = form.title.value.trim();
    plan.category = form.category.value;
    plan.priority = form.priority.value;
    plan.dueDate = form.dueDate.value || null;
    plan.reminder = parseInt(form.reminder.value, 10) || 0;
    plan.notes = form.notes.value.trim();
    plan.recurring = form.recurring.value;
    plan.notified = plan.notified || {};

    if (!plan.title) { toast('Title is required', 'error'); return; }

    await DB.savePlan(plan);
    state.plans = await DB.getAllPlans();
    closePlanModal();
    renderAll();
    toast(state.editingPlan ? '✏️ Plan updated' : '✨ Plan created', 'success');
    playSound('chime');
  }

  // ===== Calendar =====
  function renderCalendar() {
    const calBody = document.getElementById('calBody');
    const monthLabel = document.getElementById('calMonth');
    if (!calBody) return;

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthLabel.textContent = `${monthNames[state.calMonth]} ${state.calYear}`;

    const firstDay = new Date(state.calYear, state.calMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(state.calYear, state.calMonth, 0).getDate();

    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-day-name">${d}</div>`).join('');

    // Prev month tail
    for (let i = startWeekday - 1; i >= 0; i--) {
      html += `<div class="cal-day other"><div class="cal-day-num">${prevMonthDays - i}</div></div>`;
    }

    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(state.calYear, state.calMonth, d);
      const isTodayCell = dayDate.toDateString() === today.toDateString();
      const dayPlans = state.plans.filter(p => {
        if (!p.dueDate) return false;
        const pd = new Date(p.dueDate);
        return pd.getFullYear() === state.calYear && pd.getMonth() === state.calMonth && pd.getDate() === d;
      });
      html += `<div class="cal-day ${isTodayCell ? 'today' : ''} ${dayPlans.length ? 'has-events' : ''}" data-date="${dayDate.toISOString()}">
        <div class="cal-day-num">${d}</div>
        ${dayPlans.length ? `<div class="cal-day-count">${dayPlans.length} ${dayPlans.length === 1 ? 'plan' : 'plans'}</div>` : ''}
      </div>`;
    }

    // Next month head
    const totalCells = startWeekday + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder > 0) {
      for (let d = 1; d <= 7 - remainder; d++) {
        html += `<div class="cal-day other"><div class="cal-day-num">${d}</div></div>`;
      }
    }

    calBody.innerHTML = html;

    // Click handler -> show day plans
    calBody.querySelectorAll('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const date = new Date(el.dataset.date);
        showDayPlans(date);
      });
    });

    // Render upcoming list beside calendar
    const upcoming = state.plans
      .filter(p => p.dueDate && new Date(p.dueDate).getMonth() === state.calMonth && new Date(p.dueDate).getFullYear() === state.calYear)
      .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    const upList = document.getElementById('calUpcomingList');
    if (upList) {
      if (upcoming.length === 0) {
        upList.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><div>No plans this month</div></div>';
      } else {
        upList.innerHTML = upcoming.slice(0, 12).map(p => planItemHTML(p)).join('');
        attachPlanHandlers(upList);
      }
    }
  }

  function showDayPlans(date) {
    const dayPlans = state.plans.filter(p => {
      if (!p.dueDate) return false;
      const pd = new Date(p.dueDate);
      return pd.toDateString() === date.toDateString();
    });
    const label = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (dayPlans.length === 0) {
      if (confirm(`No plans on ${label}.\n\nCreate one?`)) {
        const t = new Date(date); t.setHours(9, 0, 0, 0);
        openPlanModal();
        document.getElementById('planForm').dueDate.value = t.toISOString().slice(0, 16);
      }
    } else {
      // Quick view
      alert(`📅 ${label}\n\n${dayPlans.map(p => `${p.status === 'done' ? '✓' : '•'} ${p.title} [${p.category}/${p.priority}]`).join('\n')}`);
    }
  }

  // ===== Reports =====
  function renderReports() {
    const total = state.plans.length;
    const done = state.plans.filter(p => p.status === 'done').length;
    const pending = total - done;
    const overdue = state.plans.filter(p => p.status !== 'done' && isOverdue(p.dueDate)).length;
    const rate = total ? Math.round(done / total * 100) : 0;

    document.getElementById('reportTotal').textContent = total;
    document.getElementById('reportDone').textContent = done;
    document.getElementById('reportPending').textContent = pending;
    document.getElementById('reportOverdue').textContent = overdue;
    document.getElementById('reportRate').textContent = rate + '%';
  }

  // ===== Export/Import =====
  async function exportData() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brainjet-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('💾 Backup downloaded', 'success');
  }

  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await DB.importAll(data);
      state.plans = await DB.getAllPlans();
      renderAll();
      toast(`📥 Imported ${data.plans?.length || 0} plans`, 'success');
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  }

  async function clearAllData() {
    if (!confirm('⚠️ DELETE ALL DATA?\n\nThis will remove all plans, notes, and chat history. This cannot be undone.')) return;
    if (!confirm('Are you 100% sure?')) return;
    await DB.clearAll();
    state.plans = [];
    renderAll();
    toast('🗑️ All data cleared', 'warning');
  }

  // ===== Reminder loop =====
  function startReminderLoop() {
    checkReminders();
    state.reminderCheckInterval = setInterval(checkReminders, 30000); // every 30s
  }

  async function checkReminders() {
    const now = Date.now();
    for (const p of state.plans) {
      if (p.status === 'done' || !p.dueDate) continue;
      const dueTime = new Date(p.dueDate).getTime();
      const remTime = dueTime - (p.reminder || 0) * 60000;
      p.notified = p.notified || {};

      // Reminder fire
      if (!p.notified.reminder && now >= remTime && now < dueTime + 60000) {
        fireNotif(p, '🔔 Reminder', `"${p.title}" is due ${friendlyTime(p.dueDate)}`);
        p.notified.reminder = true;
        await DB.savePlan(p);
      }
      // Due now (within 1 min window)
      if (!p.notified.due && now >= dueTime && now < dueTime + 60000) {
        fireNotif(p, '⏰ Due Now!', `"${p.title}" is due now!`);
        p.notified.due = true;
        await DB.savePlan(p);
      }
      // Overdue (1 hour past)
      if (!p.notified.overdue && now > dueTime + 3600000) {
        fireNotif(p, '⚠️ Overdue', `"${p.title}" is overdue!`);
        p.notified.overdue = true;
        await DB.savePlan(p);
      }
    }
    renderReminderBanner();
  }

  function fireNotif(plan, title, body) {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION', title, body, tag: plan.id
        });
      } else {
        try { new Notification(title, { body, tag: plan.id, icon: './icons/icon-192.png' }); } catch(e) {}
      }
    }
    // In-app toast
    toast(`${title}: ${plan.title}`, 'warning', 7000);
    // Sound
    playSound('alarm');
  }

  function playSound(type = 'ding') {
    if (!state.soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      const sounds = {
        ding: { freq: 880, dur: 0.18 },
        chime: { freq: 1320, dur: 0.25 },
        alarm: { freq: 660, dur: 0.5 }
      };
      const s = sounds[type] || sounds.ding;
      o.frequency.value = s.freq;
      o.type = 'sine';
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.dur);
      o.start();
      o.stop(ctx.currentTime + s.dur);
      if (type === 'alarm') {
        setTimeout(() => playSound('ding'), 200);
      }
    } catch(e) {}
  }

  // ===== AI Chat =====
  function toggleAI() {
    const panel = document.getElementById('aiPanel');
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) {
      document.getElementById('aiInput')?.focus();
      if (!panel.dataset.initialized) {
        addAIMessage('bot', "Hi! I'm <strong>Jet</strong>, your BrainJet assistant. 🌅<br>Ask about your tasks, farm advice, family balance, or anything! Try the chips below 👇");
        renderAISuggestions();
        panel.dataset.initialized = '1';
      }
    }
  }

  function renderAISuggestions() {
    const wrap = document.getElementById('aiSuggestions');
    if (!wrap) return;
    wrap.innerHTML = BrainJetAI.getSuggestions().map(s =>
      `<div class="ai-chip">${s}</div>`
    ).join('');
    wrap.querySelectorAll('.ai-chip').forEach(c => {
      c.addEventListener('click', () => {
        document.getElementById('aiInput').value = c.textContent;
        sendAI();
      });
    });
  }

  async function sendAI() {
    const input = document.getElementById('aiInput');
    const text = input.value.trim();
    if (!text) return;
    addAIMessage('user', escape(text));
    input.value = '';
    // Thinking placeholder
    const thinkingEl = addAIMessage('bot', '<em style="opacity:0.6">Thinking…</em>');
    const result = await BrainJetAI.ask(text, { plans: state.plans }, { online: state.aiOnline });
    thinkingEl.innerHTML = result.text.replace(/\n/g, '<br>');
    if (result.source === 'online') thinkingEl.innerHTML += '<br><span style="font-size:10px;opacity:0.5">⚡ online boost</span>';
  }

  function addAIMessage(type, html) {
    const wrap = document.getElementById('aiMessages');
    const el = document.createElement('div');
    el.className = 'ai-msg ' + type;
    el.innerHTML = html;
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
    return el;
  }

  // ===== Helpers =====
  function isToday(s) {
    if (!s) return false;
    return new Date(s).toDateString() === new Date().toDateString();
  }
  function isOverdue(s) {
    if (!s) return false;
    return new Date(s) < new Date() && !isToday(s);
  }
  function isThisWeek(s) {
    if (!s) return false;
    const d = new Date(s); const t = new Date();
    const diff = (d - t) / 86400000;
    return diff >= -1 && diff <= 7;
  }
  function isDueSoon(s, mins) {
    if (!s) return false;
    const diff = new Date(s) - new Date();
    return diff > 0 && diff <= mins * 60000;
  }
  function priorityWeight(p) {
    return p === 'high' ? 3 : p === 'medium' ? 2 : 1;
  }
  function friendlyTime(s) {
    const diff = (new Date(s) - new Date()) / 60000;
    if (diff < 0) return 'past due';
    if (diff < 1) return 'now';
    if (diff < 60) return `in ${Math.round(diff)} min`;
    if (diff < 1440) return `in ${Math.round(diff/60)}h`;
    return `on ${new Date(s).toLocaleDateString()}`;
  }
  function escape(s) {
    return String(s || '').replace(/[<>&"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' })[c]);
  }
  function toast(msg, type = 'success', dur = 3500) {
    const wrap = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), dur + 400);
  }

  // Expose
  window.App = { init, switchView, openPlanModal, toast };

  return { init, switchView };
})();

window.addEventListener('DOMContentLoaded', App.init);
