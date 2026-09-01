/* ProjectPulse — project detail page logic */
requireAuth();
renderShell('');

const user = PPApi.currentUser();
const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');
if (!projectId) window.location.href = 'dashboard.html';

let project = null;
let tasks = [];
let milestones = [];
let issues = [];
let risks = [];
let taskStatusChart, issuePriorityChart, riskDistChart;

// Role gates: managers/admins run the project; members do their assigned work
// and can still report issues; viewers/faculty are strictly read-only.
const isManagerOrAdmin = ['manager', 'admin'].includes(user.role);
const isViewer = user.role === 'viewer';

if (!isManagerOrAdmin) {
  // Only managers/admins create tasks, milestones, risks, or add members.
  document.getElementById('addTaskBtn')?.remove();
  document.getElementById('addMilestoneBtn')?.remove();
  document.getElementById('addRiskBtn')?.remove();
  document.getElementById('addMemberBtn')?.remove();
  document.getElementById('deleteTaskBtn')?.remove();
}
if (isViewer) {
  // Viewers/faculty are read-only: no issue reporting either.
  document.getElementById('addIssueBtn')?.remove();
}
let activeTaskId = null;

const STATUS_COLS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Completed'];

// ---------- Tabs ----------
document.querySelectorAll('.ptab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ptab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.ptab-view').forEach((v) => (v.style.display = 'none'));
    document.getElementById(`ptab-${btn.dataset.tab}`).style.display = '';
    if (btn.dataset.tab === 'chat') loadChatHistory();
    if (btn.dataset.tab === 'reports') loadReports();
  });
});

// ---------- Load project header ----------
async function loadProject() {
  try {
    project = await PPApi.get(`/projects/${projectId}`);
    renderHeader();
    populateAssigneeSelects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderHeader() {
  const dl = deadlineLabel(project.endDate);
  document.getElementById('projectHeader').innerHTML = `
    <div class="ph-top">
      <div>
        <div style="display:flex; align-items:center; gap:10px;">
          <h1 style="font-size:22px;">${project.name}</h1>
          <span class="badge badge-neutral">${project.code || ''}</span>
        </div>
        <p style="color:var(--text-600); font-size:14px; margin-top:6px; max-width:640px;">${project.description || 'No description.'}</p>
      </div>
      <div style="text-align:right;">
        <span class="health-pulse ${project.health}" style="justify-content:flex-end;">
          <svg viewBox="0 0 40 20"><path d="M0 10 H8 L11 5 L14 15 L17 10 H40"/></svg>
          <span class="health-label ${project.health}">${project.health} · ${project.healthScore ?? 100} pts</span>
        </span>
        <div style="margin-top:8px;"><span class="badge badge-teal">${project.status}</span> <span class="badge ${dl.cls}">${dl.text}</span></div>
      </div>
    </div>
    <div class="ph-info-grid">
      <div><div class="k">Manager</div><div class="v">${project.manager?.name || '—'}</div></div>
      <div><div class="k">Priority</div><div class="v">${project.priority}</div></div>
      <div><div class="k">Team Size</div><div class="v">${(project.teamMembers || []).length}</div></div>
      <div><div class="k">Start Date</div><div class="v">${fmtDate(project.startDate)}</div></div>
      <div><div class="k">Deadline</div><div class="v">${fmtDate(project.endDate)}</div></div>
    </div>
    <div style="margin-top:16px;">
      <div class="progress-track"><div class="progress-fill" style="width:${project.progress}%;"></div></div>
      <div style="font-size:12px; color:var(--text-400); margin-top:5px;">${project.progress}% complete</div>
    </div>`;

  document.getElementById('healthBreakdown').innerHTML = `
    <p style="font-size:13px; color:var(--text-600); line-height:1.7;">
      Health starts at 100 points and is reduced by overdue tasks (-5 each), critical issues (-10 each),
      high/critical risks (-8 each), missed milestones (-10 each), and budget overrun (-15).
    </p>
    <div style="margin-top:10px; display:flex; align-items:center; gap:10px;">
      <span class="health-pulse ${project.health}"><svg viewBox="0 0 40 20"><path d="M0 10 H8 L11 5 L14 15 L17 10 H40"/></svg></span>
      <b style="font-size:20px;">${project.healthScore ?? 100}</b><span style="color:var(--text-400); font-size:13px;">/ 100</span>
    </div>`;

  const used = project.usedBudget || 0;
  const total = project.budget || 0;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  document.getElementById('budgetPanel').innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
      <span>Used: <b>₹${used.toLocaleString()}</b></span><span>Total: <b>₹${total.toLocaleString()}</b></span>
    </div>
    <div class="progress-track"><div class="progress-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warn' : ''}" style="width:${Math.min(pct, 100)}%;"></div></div>
    <div style="font-size:12px; color:var(--text-400); margin-top:6px;">Remaining: ₹${(total - used).toLocaleString()} (${pct}% used)</div>`;
}

function populateAssigneeSelects() {
  const members = project.teamMembers || [];
  const opts = members.map((m) => `<option value="${m._id}">${m.name}</option>`).join('');
  ['tf_assignedTo', 'if_assignedTo'].forEach((id) => {
    document.getElementById(id).innerHTML = `<option value="">Unassigned</option>` + opts;
  });
}

function renderActivity(list) {
  const el = document.getElementById('projectActivity');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><p>No activity recorded yet.</p></div>`;
    return;
  }
  el.innerHTML = list
    .map(
      (a) => `
    <div class="activity-item">
      <div class="dot"></div>
      <div>
        <div>${a.user ? `<b>${a.user.name}</b>` : 'Someone'} ${a.action}${a.details ? ` — ${a.details}` : ''}</div>
        <div class="meta">${timeAgo(a.createdAt)}</div>
      </div>
    </div>`
    )
    .join('');
}

// ---------- Tasks / Kanban ----------
async function loadTasks() {
  try {
    tasks = await PPApi.get(`/tasks?project=${projectId}`);
    renderKanban();
    renderWorkload();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = STATUS_COLS.map(
    (status) => `
    <div class="kanban-col" data-status="${status}">
      <div class="kanban-col-header"><span>${status}</span><span class="kanban-count">${tasks.filter((t) => t.status === status).length}</span></div>
      <div class="kanban-cards" data-status="${status}"></div>
    </div>`
  ).join('');

  STATUS_COLS.forEach((status) => {
    const colBody = board.querySelector(`.kanban-cards[data-status="${status}"]`);
    tasks.filter((t) => t.status === status).forEach((t) => colBody.appendChild(taskCardEl(t)));

    const colWrap = board.querySelector(`.kanban-col[data-status="${status}"]`);
    colWrap.addEventListener('dragover', (e) => {
      e.preventDefault();
      colWrap.classList.add('drag-over');
    });
    colWrap.addEventListener('dragleave', () => colWrap.classList.remove('drag-over'));
    colWrap.addEventListener('drop', async (e) => {
      e.preventDefault();
      colWrap.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const t = tasks.find((x) => x._id === taskId);
      if (!t || t.status === status) return;
      try {
        await PPApi.put(`/tasks/${taskId}`, { status });
        showToast(`Task moved to ${status}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function taskCardEl(t) {
  const div = document.createElement('div');
  div.className = `kanban-card priority-${t.priority}`;
  div.draggable = true;
  div.dataset.id = t._id;
  const dl = deadlineLabel(t.dueDate);
  div.innerHTML = `
    <div class="title">${t.title}</div>
    <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${t.progress}%;"></div></div>
    <div class="footer">
      <span class="badge ${dl.cls}" style="font-size:10px;">${dl.text}</span>
      <div class="avatar avatar-sm" title="${t.assignedTo?.name || 'Unassigned'}">${t.assignedTo ? initials(t.assignedTo.name) : '?'}</div>
    </div>`;
  div.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', t._id);
    div.classList.add('dragging');
  });
  div.addEventListener('dragend', () => div.classList.remove('dragging'));
  div.addEventListener('click', () => openTaskDetail(t._id));
  return div;
}

const taskModal = document.getElementById('taskModalOverlay');
document.getElementById('addTaskBtn')?.addEventListener('click', () => (taskModal.style.display = 'flex'));
document.getElementById('closeTaskModal').addEventListener('click', () => (taskModal.style.display = 'none'));
document.getElementById('cancelTaskModal').addEventListener('click', () => (taskModal.style.display = 'none'));
document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await PPApi.post('/tasks', {
      title: document.getElementById('tf_title').value.trim(),
      description: document.getElementById('tf_description').value.trim(),
      project: projectId,
      assignedTo: document.getElementById('tf_assignedTo').value || undefined,
      priority: document.getElementById('tf_priority').value,
      status: document.getElementById('tf_status').value,
      dueDate: document.getElementById('tf_dueDate').value || undefined,
      estimatedHours: Number(document.getElementById('tf_estimatedHours').value) || 0,
    });
    showToast('Task created', 'success');
    taskModal.style.display = 'none';
    document.getElementById('taskForm').reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

const taskDetailOverlay = document.getElementById('taskDetailOverlay');
async function openTaskDetail(taskId) {
  activeTaskId = taskId;
  const t = tasks.find((x) => x._id === taskId);
  if (!t) return;
  document.getElementById('td_title').textContent = t.title;
  document.getElementById('td_meta').innerHTML = `
    <p style="font-size:13px; color:var(--text-600); margin-bottom:8px;">${t.description || 'No description.'}</p>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <span class="badge badge-neutral">${t.priority} priority</span>
      <span class="badge badge-neutral">Assigned: ${t.assignedTo?.name || 'Unassigned'}</span>
      <span class="badge ${deadlineLabel(t.dueDate).cls}">${deadlineLabel(t.dueDate).text}</span>
    </div>`;
  document.getElementById('td_progress').value = t.progress;
  document.getElementById('td_progressLabel').textContent = `${t.progress}%`;
  document.getElementById('td_status').value = t.status;
  taskDetailOverlay.style.display = 'flex';
  loadTaskComments(taskId);
}
document.getElementById('closeTaskDetail').addEventListener('click', () => (taskDetailOverlay.style.display = 'none'));
document.getElementById('td_progress').addEventListener('input', (e) => {
  document.getElementById('td_progressLabel').textContent = `${e.target.value}%`;
});
document.getElementById('saveTaskDetailBtn').addEventListener('click', async () => {
  try {
    await PPApi.put(`/tasks/${activeTaskId}`, {
      progress: Number(document.getElementById('td_progress').value),
      status: document.getElementById('td_status').value,
    });
    showToast('Task updated', 'success');
    taskDetailOverlay.style.display = 'none';
  } catch (err) {
    showToast(err.message, 'error');
  }
});
document.getElementById('deleteTaskBtn')?.addEventListener('click', async () => {
  if (!confirm('Delete this task?')) return;
  try {
    await PPApi.del(`/tasks/${activeTaskId}`);
    showToast('Task deleted', 'success');
    taskDetailOverlay.style.display = 'none';
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function loadTaskComments(taskId) {
  const el = document.getElementById('td_comments');
  el.innerHTML = `<div class="skeleton" style="height:40px;"></div>`;
  try {
    const list = await PPApi.get(`/comments?targetType=Task&targetId=${taskId}`);
    el.innerHTML = list.length
      ? list
          .map(
            (c) => `<div style="padding:7px 0; border-bottom:1px solid var(--border); font-size:13px;">
        <b>${c.user.name}</b>: ${c.message}
        <div style="font-size:11px; color:var(--text-400);">${timeAgo(c.createdAt)}</div></div>`
          )
          .join('')
      : `<p style="font-size:12px; color:var(--text-400);">No comments yet.</p>`;
  } catch {
    el.innerHTML = '';
  }
}
document.getElementById('td_commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('td_commentInput');
  if (!input.value.trim()) return;
  try {
    await PPApi.post('/comments', {
      message: input.value.trim(),
      targetType: 'Task',
      targetId: activeTaskId,
      project: projectId,
    });
    input.value = '';
    loadTaskComments(activeTaskId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Milestones ----------
async function loadMilestones() {
  try {
    milestones = await PPApi.get(`/milestones?project=${projectId}`);
    renderMilestones();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function renderMilestones() {
  const el = document.getElementById('milestoneTimeline');
  if (!milestones.length) {
    el.innerHTML = `<div class="empty-state">${icon('calendar')}<h4>No milestones yet</h4></div>`;
    return;
  }
  el.innerHTML = `<div class="timeline">${milestones
    .map((m) => {
      const cls = m.status === 'Completed' ? 'done' : m.status === 'Missed' ? 'missed' : m.status === 'In Progress' ? 'active' : '';
      return `
      <div class="timeline-item ${cls}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div>
            <div class="timeline-title">${m.name}</div>
            <div class="timeline-sub">${m.description || ''} · Due ${fmtDate(m.dueDate)}</div>
          </div>
          <select class="btn btn-outline btn-sm milestone-status" data-id="${m._id}">
            <option ${m.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option ${m.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option ${m.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option ${m.status === 'Missed' ? 'selected' : ''}>Missed</option>
          </select>
        </div>
      </div>`;
    })
    .join('')}</div>`;

  el.querySelectorAll('.milestone-status').forEach((sel) =>
    sel.addEventListener('change', async () => {
      try {
        await PPApi.put(`/milestones/${sel.dataset.id}`, {
          status: sel.value,
          completion: sel.value === 'Completed' ? 100 : sel.value === 'In Progress' ? 50 : 0,
        });
        showToast('Milestone updated', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    })
  );
}
const milestoneModal = document.getElementById('milestoneModalOverlay');
document.getElementById('addMilestoneBtn')?.addEventListener('click', () => (milestoneModal.style.display = 'flex'));
document.getElementById('closeMilestoneModal').addEventListener('click', () => (milestoneModal.style.display = 'none'));
document.getElementById('cancelMilestoneModal').addEventListener('click', () => (milestoneModal.style.display = 'none'));
document.getElementById('milestoneForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await PPApi.post('/milestones', {
      name: document.getElementById('mf_name').value.trim(),
      description: document.getElementById('mf_description').value.trim(),
      project: projectId,
      owner: user._id || user.id,
      dueDate: document.getElementById('mf_dueDate').value || undefined,
      order: milestones.length,
    });
    showToast('Milestone created', 'success');
    milestoneModal.style.display = 'none';
    document.getElementById('milestoneForm').reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Issues ----------
async function loadIssues() {
  try {
    issues = await PPApi.get(`/issues?project=${projectId}`);
    renderIssues();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function renderIssues() {
  const tbody = document.getElementById('issuesTableBody');
  if (!issues.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('folder')}<h4>No issues reported</h4></div></td></tr>`;
    return;
  }
  const prBadge = { Critical: 'badge-red', High: 'badge-yellow', Medium: 'badge-teal', Low: 'badge-neutral' };
  tbody.innerHTML = issues
    .map(
      (i) => `
    <tr>
      <td><b>${i.title}</b></td>
      <td><span class="badge ${prBadge[i.priority]}">${i.priority}</span></td>
      <td>
        <select class="issue-status" data-id="${i._id}" style="border:1px solid var(--border); border-radius:6px; padding:4px 6px; font-size:12px;">
          ${['Open', 'Investigating', 'In Progress', 'Resolved', 'Closed'].map((s) => `<option ${i.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${i.reportedBy?.name || '—'}</td>
      <td>${i.assignedTo?.name || 'Unassigned'}</td>
      <td></td>
    </tr>`
    )
    .join('');
  tbody.querySelectorAll('.issue-status').forEach((sel) =>
    sel.addEventListener('change', async () => {
      try {
        await PPApi.put(`/issues/${sel.dataset.id}`, { status: sel.value });
        showToast('Issue updated', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    })
  );
}
const issueModal = document.getElementById('issueModalOverlay');
document.getElementById('addIssueBtn')?.addEventListener('click', () => (issueModal.style.display = 'flex'));
document.getElementById('closeIssueModal').addEventListener('click', () => (issueModal.style.display = 'none'));
document.getElementById('cancelIssueModal').addEventListener('click', () => (issueModal.style.display = 'none'));
document.getElementById('issueForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await PPApi.post('/issues', {
      title: document.getElementById('if_title').value.trim(),
      description: document.getElementById('if_description').value.trim(),
      project: projectId,
      priority: document.getElementById('if_priority').value,
      assignedTo: document.getElementById('if_assignedTo').value || undefined,
    });
    showToast('Issue reported', 'success');
    issueModal.style.display = 'none';
    document.getElementById('issueForm').reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Risks ----------
async function loadRisks() {
  try {
    risks = await PPApi.get(`/risks?project=${projectId}`);
    renderRisks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function renderRisks() {
  const tbody = document.getElementById('risksTableBody');
  if (!risks.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('folder')}<h4>No risks logged</h4></div></td></tr>`;
    return;
  }
  const lvlBadge = { CRITICAL: 'badge-red', HIGH: 'badge-yellow', MEDIUM: 'badge-teal', LOW: 'badge-neutral' };
  tbody.innerHTML = risks
    .map(
      (r) => `
    <tr>
      <td><b>${r.name}</b><br><span style="font-size:11px; color:var(--text-400);">${r.description || ''}</span></td>
      <td>${r.probability}</td>
      <td>${r.impact}</td>
      <td>${r.riskScore}</td>
      <td><span class="badge ${lvlBadge[r.level]}">${r.level}</span></td>
      <td>
        <select class="risk-status" data-id="${r._id}" style="border:1px solid var(--border); border-radius:6px; padding:4px 6px; font-size:12px;">
          ${['Open', 'Mitigated', 'Closed'].map((s) => `<option ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>`
    )
    .join('');
  tbody.querySelectorAll('.risk-status').forEach((sel) =>
    sel.addEventListener('change', async () => {
      try {
        await PPApi.put(`/risks/${sel.dataset.id}`, { status: sel.value });
        showToast('Risk updated', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    })
  );
}
const riskModal = document.getElementById('riskModalOverlay');
document.getElementById('addRiskBtn')?.addEventListener('click', () => (riskModal.style.display = 'flex'));
document.getElementById('closeRiskModal').addEventListener('click', () => (riskModal.style.display = 'none'));
document.getElementById('cancelRiskModal').addEventListener('click', () => (riskModal.style.display = 'none'));
document.getElementById('riskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await PPApi.post('/risks', {
      name: document.getElementById('rf_name').value.trim(),
      description: document.getElementById('rf_description').value.trim(),
      project: projectId,
      owner: user._id || user.id,
      probability: Number(document.getElementById('rf_probability').value),
      impact: Number(document.getElementById('rf_impact').value),
      mitigation: document.getElementById('rf_mitigation').value.trim(),
    });
    showToast('Risk logged', 'success');
    riskModal.style.display = 'none';
    document.getElementById('riskForm').reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Team / Workload ----------
function renderWorkload() {
  const grid = document.getElementById('workloadGrid');
  const members = project ? project.teamMembers || [] : [];
  if (!members.length) {
    grid.innerHTML = `<div class="empty-state">${icon('users')}<h4>No team members yet</h4></div>`;
    return;
  }
  const counts = members.map((mm) => tasks.filter((t) => t.assignedTo && t.assignedTo._id === mm._id).length);
  const maxCount = Math.max(...counts, 1);
  grid.innerHTML = members
    .map((m) => {
      const memberTasks = tasks.filter((t) => t.assignedTo && t.assignedTo._id === m._id);
      const completed = memberTasks.filter((t) => t.status === 'Completed').length;
      const inProgress = memberTasks.filter((t) => t.status === 'In Progress').length;
      const blocked = memberTasks.filter((t) => t.status === 'Blocked').length;
      const workloadPct = Math.round((memberTasks.length / maxCount) * 100);
      return `
      <div class="card team-card" style="text-align:left;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <div class="avatar">${initials(m.name)}</div>
          <div><div style="font-weight:600; font-size:14px;">${m.name}</div><div style="font-size:11px; color:var(--text-400); text-transform:capitalize;">${m.role || ''}</div></div>
        </div>
        <div class="workload-bar-label"><span>Assigned: ${memberTasks.length}</span><span>Completed: ${completed}</span></div>
        <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${workloadPct}%;"></div></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <span class="badge badge-teal">In progress: ${inProgress}</span>
          <span class="badge badge-red">Blocked: ${blocked}</span>
        </div>
      </div>`;
    })
    .join('');
}
const memberModal = document.getElementById('memberModalOverlay');
document.getElementById('addMemberBtn')?.addEventListener('click', async () => {
  const allUsers = await PPApi.get('/users');
  const existingIds = new Set((project.teamMembers || []).map((m) => m._id));
  const available = allUsers.filter((u) => !existingIds.has(u._id));
  document.getElementById('mem_userSelect').innerHTML =
    available.map((u) => `<option value="${u._id}">${u.name} (${u.role})</option>`).join('') || '<option value="">No available users</option>';
  memberModal.style.display = 'flex';
});
document.getElementById('closeMemberModal').addEventListener('click', () => (memberModal.style.display = 'none'));
document.getElementById('cancelMemberModal').addEventListener('click', () => (memberModal.style.display = 'none'));
document.getElementById('confirmAddMemberBtn').addEventListener('click', async () => {
  const userId = document.getElementById('mem_userSelect').value;
  if (!userId) return;
  try {
    await PPApi.post(`/projects/${projectId}/members`, { userId });
    showToast('Member added', 'success');
    memberModal.style.display = 'none';
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---------- Documents ----------
async function loadDocuments() {
  const el = document.getElementById('documentList');
  el.innerHTML = `<div class="skeleton" style="height:120px;"></div>`;
  try {
    const docs = await PPApi.get(`/documents?project=${projectId}`);
    el.innerHTML = docs.length
      ? docs
          .map(
            (d) => `
      <div class="task-row">
        <div style="flex:1;"><div class="task-title">${d.name}</div><div class="task-project">${d.type} · uploaded by ${d.uploadedBy?.name || '—'} · ${timeAgo(d.createdAt)}</div></div>
        <a href="${d.fileUrl}" target="_blank" class="btn btn-outline btn-sm">Download</a>
      </div>`
          )
          .join('')
      : `<div class="empty-state">${icon('folder')}<h4>No documents uploaded</h4></div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}
document.getElementById('docUploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  form.append('name', file.name);
  form.append('project', projectId);
  try {
    await PPApi.post('/documents', form, true);
    showToast('Document uploaded', 'success');
    loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
  e.target.value = '';
});

// ---------- Chat ----------
function renderChatMessage({ userId, name, message, timestamp }) {
  const container = document.getElementById('chatMessages');
  const own = userId === (user._id || user.id);
  const div = document.createElement('div');
  div.className = `chat-msg ${own ? 'own' : ''}`;
  div.innerHTML = `
    <div class="avatar avatar-sm">${initials(name)}</div>
    <div>
      <div class="chat-bubble">${message}</div>
      <div class="chat-meta">${own ? 'You' : name} · ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
function loadChatHistory() {
  const container = document.getElementById('chatMessages');
  if (!container.dataset.joined) {
    const s = getSocket();
    if (s) s.emit('joinProject', projectId);
    container.dataset.joined = '1';
  }
}
document.getElementById('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  if (!input.value.trim()) return;
  const s = getSocket();
  if (s) s.emit('sendMessage', { projectId, message: input.value.trim() });
  input.value = '';
});
let typingTimeout;
document.getElementById('chatInput').addEventListener('input', () => {
  const s = getSocket();
  if (!s) return;
  s.emit('typing', { projectId, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => s.emit('typing', { projectId, isTyping: false }), 1200);
});

// ---------- Reports ----------
function loadReports() {
  const statusCount = {};
  tasks.forEach((t) => (statusCount[t.status] = (statusCount[t.status] || 0) + 1));
  const ctx1 = document.getElementById('taskStatusChart');
  if (taskStatusChart) taskStatusChart.destroy();
  taskStatusChart = new Chart(ctx1, {
    type: 'bar',
    data: { labels: Object.keys(statusCount), datasets: [{ data: Object.values(statusCount), backgroundColor: '#00c2a8', borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });

  const prCount = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  issues.forEach((i) => (prCount[i.priority] = (prCount[i.priority] || 0) + 1));
  const ctx2 = document.getElementById('issuePriorityChart');
  if (issuePriorityChart) issuePriorityChart.destroy();
  issuePriorityChart = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: Object.keys(prCount), datasets: [{ data: Object.values(prCount), backgroundColor: ['#8890a3', '#00c2a8', '#f5b942', '#ff5a5f'] }] },
    options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' },
  });

  const riskCount = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  risks.forEach((r) => (riskCount[r.level] = (riskCount[r.level] || 0) + 1));
  const ctx3 = document.getElementById('riskDistChart');
  if (riskDistChart) riskDistChart.destroy();
  riskDistChart = new Chart(ctx3, {
    type: 'pie',
    data: { labels: Object.keys(riskCount), datasets: [{ data: Object.values(riskCount), backgroundColor: ['#22c55e', '#f5b942', '#ff5a5f', '#ef4444'] }] },
    options: { plugins: { legend: { position: 'bottom' } } },
  });

  const perfMap = {};
  tasks.forEach((t) => {
    if (!t.assignedTo) return;
    const id = t.assignedTo._id;
    if (!perfMap[id]) perfMap[id] = { name: t.assignedTo.name, assigned: 0, completed: 0 };
    perfMap[id].assigned++;
    if (t.status === 'Completed') perfMap[id].completed++;
  });
  const perfList = document.getElementById('teamPerfList');
  const entries = Object.values(perfMap);
  perfList.innerHTML = entries.length
    ? entries
        .map((p) => {
          const pct = p.assigned ? Math.round((p.completed / p.assigned) * 100) : 0;
          return `<div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;"><span>${p.name}</span><span>${pct}%</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>`;
        })
        .join('')
    : `<p style="font-size:13px; color:var(--text-400);">No task assignments yet.</p>`;
}

// ---------- Real-time ----------
const socket = getSocket();
if (socket) {
  socket.emit('joinProject', projectId);

  socket.on('taskCreated', (t) => {
    if (t.project === projectId) { tasks.push(t); renderKanban(); renderWorkload(); }
  });
  socket.on('taskUpdated', (t) => {
    if (t.project !== projectId) return;
    const idx = tasks.findIndex((x) => x._id === t._id);
    if (idx >= 0) tasks[idx] = t; else tasks.push(t);
    renderKanban();
    renderWorkload();
  });
  socket.on('taskDeleted', ({ id, project: pid }) => {
    if (pid !== projectId) return;
    tasks = tasks.filter((x) => x._id !== id);
    renderKanban();
    renderWorkload();
  });
  socket.on('projectUpdated', (p) => {
    if (p._id === projectId) { project = p; renderHeader(); populateAssigneeSelects(); }
  });
  socket.on('projectHealthUpdated', ({ projectId: pid, health, healthScore }) => {
    if (pid !== projectId || !project) return;
    project.health = health; project.healthScore = healthScore; renderHeader();
  });
  socket.on('milestoneUpdated', (m) => { if (m.project === projectId) loadMilestones(); });
  socket.on('milestoneDeleted', () => loadMilestones());
  socket.on('issueCreated', (i) => { if (i.project === projectId) { issues.unshift(i); renderIssues(); } });
  socket.on('issueUpdated', (i) => {
    if (i.project !== projectId) return;
    const idx = issues.findIndex((x) => x._id === i._id);
    if (idx >= 0) issues[idx] = i;
    renderIssues();
  });
  socket.on('riskCreated', (r) => { if (r.project === projectId) { risks.unshift(r); renderRisks(); } });
  socket.on('riskUpdated', (r) => {
    if (r.project !== projectId) return;
    const idx = risks.findIndex((x) => x._id === r._id);
    if (idx >= 0) risks[idx] = r;
    renderRisks();
  });
  socket.on('commentAdded', (c) => {
    if (c.project === projectId && c.targetType === 'Task' && c.targetId === activeTaskId) loadTaskComments(activeTaskId);
  });
  socket.on('documentUploaded', (d) => { if (d.project === projectId) loadDocuments(); });
  socket.on('activityLogged', (a) => {
    if (a.project !== projectId) return;
    const el = document.getElementById('projectActivity');
    const wasEmpty = el.querySelector('.empty-state');
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `<div class="dot"></div><div><div>${a.user ? `<b>${a.user.name}</b>` : 'Someone'} ${a.action}${a.details ? ` — ${a.details}` : ''}</div><div class="meta">just now</div></div>`;
    if (wasEmpty) el.innerHTML = '';
    el.prepend(item);
  });
  socket.on('messageReceived', (payload) => renderChatMessage(payload));
  socket.on('userTyping', ({ name, isTyping }) => {
    document.getElementById('typingIndicator').textContent = isTyping ? `${name} is typing…` : '';
  });
}

// ---------- Init ----------
(async function init() {
  await loadProject();
  await loadTasks();
  await loadMilestones();
  await loadIssues();
  await loadRisks();
  loadDocuments();
  renderActivity([]);
})();
