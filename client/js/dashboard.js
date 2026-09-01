/* ProjectPulse — dashboard page logic */
requireAuth();
renderShell('dashboard.html');

const user = PPApi.currentUser();
let allProjects = [];
let allTasks = [];
let statusChartInstance, projectStatusChartInstance, healthChartInstance;

document.getElementById('greeting').textContent = `Welcome back, ${user.name.split(' ')[0]}`;

// Only managers/admins can create projects — hide the buttons for everyone else.
if (!['manager', 'admin'].includes(user.role)) {
  document.getElementById('newProjectBtnOverview')?.remove();
  document.getElementById('newProjectBtnList')?.remove();
}

// ---------- Tab routing ----------
const TABS = {
  '': 'view-overview',
  '#projects': 'view-projects',
  '#mytasks': 'view-mytasks',
  '#team': 'view-team',
  '#calendar': 'view-calendar',
  '#reports': 'view-reports',
};

function routeTab() {
  const hash = window.location.hash || '';
  const targetId = TABS[hash] || 'view-overview';
  document.querySelectorAll('.tab-view').forEach((el) => (el.style.display = el.id === targetId ? '' : 'none'));
  document.querySelectorAll('.nav-link').forEach((el) => {
    const href = el.getAttribute('href') || '';
    el.classList.toggle('active', href === 'dashboard.html' + hash || (hash === '' && href === 'dashboard.html'));
  });
  if (targetId === 'view-team') loadTeam();
  if (targetId === 'view-mytasks') loadMyTasks();
  if (targetId === 'view-calendar') loadCalendar();
  if (targetId === 'view-reports') loadReports();
  if (targetId === 'view-projects') renderProjectsTable();
}
window.addEventListener('hashchange', routeTab);

// ---------- Load core data ----------
async function loadOverview() {
  try {
    const { stats, statusDistribution } = await PPApi.get('/reports/dashboard');
    renderStats(stats);
    renderStatusChart(statusDistribution);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderStats(stats) {
  const cards = [
    ['Total Projects', stats.totalProjects, `${stats.activeProjects} active`],
    ['Completed Projects', stats.completedProjects, `${stats.delayedProjects} delayed`],
    ['Total Tasks', stats.totalTasks, `${stats.completedTasks} completed`],
    ['Team Members', stats.teamMembers, `${stats.pendingTasks} pending tasks`],
  ];
  document.getElementById('statGrid').innerHTML = cards
    .map(
      ([label, value, sub]) => `
    <div class="card stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`
    )
    .join('');
}

function renderStatusChart(dist) {
  const ctx = document.getElementById('statusChart');
  const labels = Object.keys(dist);
  const values = Object.values(dist);
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#8890a3', '#7c6cf6', '#f5b942', '#00c2a8', '#22c55e', '#ff5a5f'],
          borderWidth: 0,
        },
      ],
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }, cutout: '65%' },
  });
}

async function loadProjects() {
  try {
    allProjects = await PPApi.get('/projects');
    renderProjectGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function healthPulseSvg(health) {
  const paths = {
    GREEN: 'M0 10 H8 L11 5 L14 15 L17 10 H40',
    YELLOW: 'M0 10 H6 L9 3 L12 16 L15 6 L18 14 L21 10 H40',
    RED: 'M0 10 H4 L6 2 L9 18 L11 2 L13 18 L15 10 H18 L20 4 L22 16 L24 10 H40',
  };
  return `<span class="health-pulse ${health}">
    <svg viewBox="0 0 40 20"><path d="${paths[health] || paths.GREEN}"/></svg>
    <span class="health-label ${health}">${health}</span>
  </span>`;
}

function projectCardHtml(p) {
  const dl = deadlineLabel(p.endDate);
  return `
  <div class="card project-card" data-id="${p._id}">
    <div class="project-card-top">
      <div>
        <h4>${p.name}</h4>
        <div class="code">${p.code || ''}</div>
      </div>
      ${healthPulseSvg(p.health)}
    </div>
    <div class="desc">${p.description || 'No description provided.'}</div>
    <div>
      <div class="progress-track"><div class="progress-fill ${p.progress < 40 ? 'warn' : ''}" style="width:${p.progress}%;"></div></div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-400); margin-top:5px;">
        <span>${p.progress}% complete</span><span class="badge ${dl.cls}">${dl.text}</span>
      </div>
    </div>
    <div class="project-card-meta">
      <span class="badge badge-neutral">${p.status}</span>
      <div class="avatar-stack">
        ${(p.teamMembers || []).slice(0, 4).map((m) => `<div class="avatar avatar-sm" title="${m.name}">${initials(m.name)}</div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderProjectGrid() {
  const grid = document.getElementById('projectGrid');
  if (!allProjects.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      ${icon('folder')}<h4>No projects found</h4><p>Create your first project to get started.</p>
    </div>`;
    return;
  }
  grid.innerHTML = allProjects
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map(projectCardHtml)
    .join('');
  attachProjectCardHandlers();
}

function renderProjectsTable() {
  const filter = document.getElementById('projectStatusFilter').value;
  const rows = allProjects.filter((p) => !filter || p.status === filter);
  const tbody = document.getElementById('projectsTableBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${icon('folder')}<h4>No projects match this filter</h4></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((p) => {
      const dl = deadlineLabel(p.endDate);
      return `
      <tr class="row-hover" data-id="${p._id}">
        <td><b>${p.name}</b><br><span style="color:var(--text-400); font-size:11px;">${p.code || ''}</span></td>
        <td>${p.manager ? p.manager.name : '—'}</td>
        <td style="width:140px;"><div class="progress-track"><div class="progress-fill" style="width:${p.progress}%;"></div></div><span style="font-size:11px; color:var(--text-400);">${p.progress}%</span></td>
        <td><span class="badge badge-neutral">${p.status}</span></td>
        <td><span class="badge ${dl.cls}">${dl.text}</span></td>
        <td>${healthPulseSvg(p.health)}</td>
        <td>${(p.teamMembers || []).length}</td>
        <td>
          ${['manager', 'admin'].includes(user.role) ? `
          <button class="btn btn-ghost btn-sm archive-btn" data-id="${p._id}">Archive</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${p._id}">Delete</button>
          ` : ''}
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('tr').forEach((tr) =>
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      window.location.href = `project.html?id=${tr.dataset.id}`;
    })
  );
  tbody.querySelectorAll('.archive-btn').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await PPApi.put(`/projects/${btn.dataset.id}/archive`);
      showToast('Project archived', 'success');
      loadProjects();
    })
  );
  tbody.querySelectorAll('.delete-btn').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this project permanently?')) return;
      await PPApi.del(`/projects/${btn.dataset.id}`);
      showToast('Project deleted', 'success');
      loadProjects();
    })
  );
}

function attachProjectCardHandlers() {
  document.querySelectorAll('.project-card').forEach((card) =>
    card.addEventListener('click', () => {
      window.location.href = `project.html?id=${card.dataset.id}`;
    })
  );
}

document.getElementById('projectStatusFilter')?.addEventListener('change', renderProjectsTable);

// ---------- Activity feed ----------
async function loadActivity() {
  try {
    const feed = document.getElementById('activityFeed');
    if (!allProjects.length) {
      feed.innerHTML = `<div class="empty-state"><p>No activity yet.</p></div>`;
      return;
    }
    feed.innerHTML = `<div class="empty-state" style="padding:20px;"><p>Open a project to see its activity timeline.</p></div>`;
  } catch {}
}

// ---------- My Tasks ----------
async function loadMyTasks() {
  const list = document.getElementById('myTasksList');
  list.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  try {
    const filterVal = document.getElementById('taskStatusFilter').value;
    let url = `/tasks?assignedTo=${user._id || user.id}`;
    if (filterVal) url += `&status=${encodeURIComponent(filterVal)}`;
    allTasks = await PPApi.get(url);
    if (!allTasks.length) {
      list.innerHTML = `<div class="empty-state">${icon('check')}<h4>No tasks assigned</h4><p>You're all caught up.</p></div>`;
      return;
    }
    list.innerHTML = allTasks
      .map((t) => {
        const dl = deadlineLabel(t.dueDate);
        return `
        <div class="task-row">
          <div style="flex:1; min-width:0;">
            <div class="task-title">${t.title}</div>
            <div class="task-project">${t.priority} priority · ${t.status}</div>
          </div>
          <span class="badge ${dl.cls}">${dl.text}</span>
          <div class="task-progress">
            <div class="progress-track"><div class="progress-fill" style="width:${t.progress}%;"></div></div>
          </div>
        </div>`;
      })
      .join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}
document.getElementById('taskStatusFilter')?.addEventListener('change', loadMyTasks);

// ---------- Team ----------
let teamUsersCache = [];
async function loadTeam() {
  const grid = document.getElementById('teamGrid');
  grid.innerHTML = `<div class="skeleton" style="height:160px;"></div>`;
  try {
    const users = await PPApi.get('/users');
    teamUsersCache = users;
    grid.innerHTML = users
      .map(
        (u) => `
      <div class="card team-card" data-id="${u._id}">
        <div class="avatar avatar-lg" style="margin:0 auto 10px;">${initials(u.name)}</div>
        <div style="font-weight:600;">${u.name}</div>
        <div style="font-size:12px; color:var(--text-400); text-transform:capitalize;">${u.role} · ${u.department || '—'}</div>
        <div style="margin-top:10px; font-size:12px;">
          <span class="status-dot ${u.online ? 'online' : 'offline'}"></span>${u.online ? 'Online' : 'Offline'}
        </div>
        ${user.role === 'manager' ? `
        <button class="btn btn-outline btn-sm view-profile-btn" data-id="${u._id}" style="margin-top:10px;">View Profile</button>
        ` : ''}
      </div>`
      )
      .join('');

    grid.querySelectorAll('.view-profile-btn').forEach((btn) =>
      btn.addEventListener('click', () => openMemberProfile(btn.dataset.id))
    );
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

// Manager-only: view a team member's profile and delete their account.
const memberProfileOverlay = document.getElementById('memberProfileOverlay');
let activeMemberId = null;

function openMemberProfile(userId) {
  const m = teamUsersCache.find((u) => u._id === userId);
  if (!m) return;
  activeMemberId = userId;
  document.getElementById('memberProfileBody').innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
      <div class="avatar avatar-lg">${initials(m.name)}</div>
      <div>
        <div style="font-weight:700; font-size:16px;">${m.name}</div>
        <div class="badge badge-violet" style="margin-top:4px; text-transform:capitalize;">${m.role}</div>
      </div>
    </div>
    <div class="field-row">
      <div><div style="font-size:12px; color:var(--text-400);">Email</div><div>${m.email}</div></div>
      <div><div style="font-size:12px; color:var(--text-400);">Phone</div><div>${m.phone || '—'}</div></div>
    </div>
    <div class="field-row" style="margin-top:12px;">
      <div><div style="font-size:12px; color:var(--text-400);">Department</div><div>${m.department || '—'}</div></div>
      <div><div style="font-size:12px; color:var(--text-400);">Status</div><div style="text-transform:capitalize;">${m.status}</div></div>
    </div>
    <div style="margin-top:12px;"><div style="font-size:12px; color:var(--text-400);">Member since</div><div>${fmtDate(m.createdAt)}</div></div>
  `;
  // A manager can't delete their own account through this panel.
  document.getElementById('deleteMemberBtn').style.display = userId === (user._id || user.id) ? 'none' : '';
  memberProfileOverlay.style.display = 'flex';
}

function closeMemberProfile() {
  memberProfileOverlay.style.display = 'none';
  activeMemberId = null;
}
document.getElementById('closeMemberProfileModal').addEventListener('click', closeMemberProfile);
document.getElementById('closeMemberProfileModal2').addEventListener('click', closeMemberProfile);
memberProfileOverlay.addEventListener('click', (e) => {
  if (e.target === memberProfileOverlay) closeMemberProfile();
});
document.getElementById('deleteMemberBtn').addEventListener('click', async () => {
  if (!activeMemberId) return;
  const m = teamUsersCache.find((u) => u._id === activeMemberId);
  if (!confirm(`Delete ${m ? m.name : 'this team member'}'s account? This cannot be undone.`)) return;
  try {
    await PPApi.del(`/users/${activeMemberId}`);
    showToast('Team member deleted', 'success');
    closeMemberProfile();
    loadTeam();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Calendar ----------
async function loadCalendar() {
  const list = document.getElementById('calendarList');
  list.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  try {
    const tasks = await PPApi.get('/tasks');
    const items = tasks
      .filter((t) => t.dueDate && t.status !== 'Completed')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 20);
    if (!items.length) {
      list.innerHTML = `<div class="empty-state">${icon('calendar')}<h4>Nothing scheduled</h4></div>`;
      return;
    }
    list.innerHTML = items
      .map((t) => {
        const d = new Date(t.dueDate);
        return `
        <div class="cal-item">
          <div class="cal-date-box"><div class="d">${d.getDate()}</div><div class="m">${d.toLocaleString('default', { month: 'short' })}</div></div>
          <div style="flex:1;">
            <div style="font-weight:600; font-size:14px;">${t.title}</div>
            <div style="font-size:12px; color:var(--text-400);">${t.priority} priority · assigned to ${t.assignedTo ? t.assignedTo.name : 'Unassigned'}</div>
          </div>
          <span class="badge ${deadlineLabel(t.dueDate).cls}">${deadlineLabel(t.dueDate).text}</span>
        </div>`;
      })
      .join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

// ---------- Reports ----------
async function loadReports() {
  try {
    if (!allProjects.length) await loadProjects();
    const statusCounts = {};
    const healthCounts = { GREEN: 0, YELLOW: 0, RED: 0 };
    allProjects.forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      healthCounts[p.health] = (healthCounts[p.health] || 0) + 1;
    });

    const ctx1 = document.getElementById('projectStatusChart');
    if (projectStatusChartInstance) projectStatusChartInstance.destroy();
    projectStatusChartInstance = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{ label: 'Projects', data: Object.values(statusCounts), backgroundColor: '#00c2a8', borderRadius: 6 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });

    const ctx2 = document.getElementById('healthChart');
    if (healthChartInstance) healthChartInstance.destroy();
    healthChartInstance = new Chart(ctx2, {
      type: 'pie',
      data: {
        labels: ['Green', 'Yellow', 'Red'],
        datasets: [{ data: [healthCounts.GREEN, healthCounts.YELLOW, healthCounts.RED], backgroundColor: ['#22c55e', '#f5b942', '#ef4444'] }],
      },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Create Project modal ----------
const overlay = document.getElementById('projectModalOverlay');
function openProjectModal() {
  overlay.style.display = 'flex';
}
function closeProjectModal() {
  overlay.style.display = 'none';
  document.getElementById('projectForm').reset();
}
document.addEventListener('pp:createProject', openProjectModal);
document.getElementById('newProjectBtnOverview')?.addEventListener('click', openProjectModal);
document.getElementById('newProjectBtnList')?.addEventListener('click', openProjectModal);
document.getElementById('closeProjectModal').addEventListener('click', closeProjectModal);
document.getElementById('cancelProjectModal').addEventListener('click', closeProjectModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeProjectModal();
});

document.getElementById('projectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitProjectBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const payload = {
      name: document.getElementById('pf_name').value.trim(),
      code: document.getElementById('pf_code').value.trim(),
      category: document.getElementById('pf_category').value.trim(),
      description: document.getElementById('pf_description').value.trim(),
      startDate: document.getElementById('pf_startDate').value || undefined,
      endDate: document.getElementById('pf_endDate').value || undefined,
      budget: Number(document.getElementById('pf_budget').value) || 0,
      priority: document.getElementById('pf_priority').value,
      status: document.getElementById('pf_status').value,
      department: document.getElementById('pf_department').value.trim(),
      client: document.getElementById('pf_client').value.trim(),
    };
    await PPApi.post('/projects', payload);
    showToast('Project created successfully.', 'success');
    closeProjectModal();
    loadProjects();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Project';
  }
});

// ---------- Demo data ----------
document.getElementById('demoDataBtn').addEventListener('click', async () => {
  const btn = document.getElementById('demoDataBtn');
  btn.disabled = true;
  btn.textContent = 'Loading…';
  try {
    await PPApi.post('/admin/seed-demo', {});
    showToast('Demo project created!', 'success');
    await loadProjects();
    loadOverview();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load Demo Data';
  }
});

// ---------- Global search ----------
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('globalSearch');
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    if (!q) return renderProjectGrid();
    const filtered = allProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
    );
    const grid = document.getElementById('projectGrid');
    grid.innerHTML = filtered.length
      ? filtered.map(projectCardHtml).join('')
      : `<div class="empty-state" style="grid-column:1/-1;"><h4>No matches for "${q}"</h4></div>`;
    attachProjectCardHandlers();
  });
});

// ---------- Real-time updates ----------
const socket = getSocket();
if (socket) {
  socket.on('projectCreated', () => loadProjects());
  socket.on('projectUpdated', () => loadProjects());
  socket.on('projectDeleted', () => loadProjects());
  socket.on('projectHealthUpdated', () => loadProjects());
  socket.on('taskUpdated', () => {
    loadOverview();
    if (window.location.hash === '#mytasks') loadMyTasks();
  });
  socket.on('taskCreated', () => loadOverview());
  socket.on('userOnline', () => {
    if (window.location.hash === '#team') loadTeam();
  });
  socket.on('userOffline', () => {
    if (window.location.hash === '#team') loadTeam();
  });
}

// ---------- Init ----------
(async function init() {
  await loadProjects();
  await loadOverview();
  loadActivity();
  routeTab();
})();
