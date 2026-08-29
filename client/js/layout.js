/* ProjectPulse — shared app shell (sidebar + topbar) */

const NAV_ITEMS = [
  { href: 'dashboard.html', label: 'Dashboard', icon: 'grid' },
  { href: 'dashboard.html#projects', label: 'Projects', icon: 'folder' },
  { href: 'dashboard.html#mytasks', label: 'My Tasks', icon: 'check' },
  { href: 'dashboard.html#team', label: 'Team', icon: 'users' },
  { href: 'dashboard.html#calendar', label: 'Calendar', icon: 'calendar' },
  { href: 'dashboard.html#reports', label: 'Reports', icon: 'chart' },
  { href: 'profile.html', label: 'Profile', icon: 'user' },
];

const ICONS = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14c2.6.2 5 1.9 5 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M11 20V4M18 20v-7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
};

function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS[name] || ''}</svg>`;
}

function renderShell(activeHref) {
  const user = PPApi.currentUser();
  if (!user) return;

  const sidebarHtml = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="brand">
          <svg class="pulse-mark" viewBox="0 0 60 30"><path d="M0 15 H16 L21 4 L27 26 L33 10 L37 15 H60"/></svg>
          ProjectPulse
        </div>
        <div class="brand-tagline">Plan. Track. Collaborate. Deliver.</div>
      </div>
      <nav class="nav-group">
        ${NAV_ITEMS.map(
          (item) => `
          <a class="nav-link ${activeHref === item.href ? 'active' : ''}" href="${item.href}">
            ${icon(item.icon)} ${item.label}
          </a>`
        ).join('')}
      </nav>
      <div class="sidebar-footer">
        <a class="nav-link" href="#" id="themeToggle">${icon('moon')} <span id="themeLabel">Dark mode</span></a>
        <a class="nav-link" href="#" id="logoutBtn">${icon('logout')} Logout</a>
        <div class="sidebar-user" style="margin-top:8px;">
          <div class="avatar avatar-sm">${initials(user.name)}</div>
          <div style="overflow:hidden;">
            <div style="font-size:13px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name}</div>
            <div style="font-size:11px; color:#8890a3; text-transform:capitalize;">${user.role}</div>
          </div>
        </div>
      </div>
    </aside>`;

  const topbarHtml = `
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="btn btn-ghost btn-icon mobile-toggle" id="mobileMenuBtn">${icon('menu')}</button>
        <div class="search-box">
          ${icon('search')}
          <input type="text" id="globalSearch" placeholder="Search projects, tasks, people…" />
        </div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-icon" id="notifBtn" style="position:relative;">
          ${icon('bell')}
          <span class="nav-badge" id="notifCount" style="position:absolute; top:2px; right:2px; display:none;">0</span>
        </button>
        <button class="btn btn-accent btn-sm" id="quickCreateBtn">${icon('plus')} New Project</button>
      </div>
    </div>
    <div id="notifPanel" class="card" style="display:none; position:absolute; right:24px; top:60px; width:340px; max-height:420px; overflow-y:auto; z-index:100;"></div>
  `;

  document.getElementById('shell-sidebar').outerHTML = sidebarHtml;
  document.getElementById('shell-topbar').outerHTML = topbarHtml;

  // Theme
  const savedTheme = localStorage.getItem('pp_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeLabel(savedTheme);
  document.getElementById('themeToggle').addEventListener('click', (e) => {
    e.preventDefault();
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pp_theme', next);
    updateThemeLabel(next);
  });

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    PPApi.logout();
  });

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('quickCreateBtn').addEventListener('click', () => {
    document.dispatchEvent(new Event('pp:createProject'));
  });

  setupNotifications();
  connectSocketForNotifications();
}

function updateThemeLabel(theme) {
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

async function setupNotifications() {
  const btn = document.getElementById('notifBtn');
  const panel = document.getElementById('notifPanel');
  const countEl = document.getElementById('notifCount');

  async function loadNotifs() {
    try {
      const notifs = await PPApi.get('/notifications');
      const unread = notifs.filter((n) => !n.read).length;
      countEl.style.display = unread > 0 ? 'block' : 'none';
      countEl.textContent = unread;
      panel.innerHTML = notifs.length
        ? notifs
            .map(
              (n) => `
          <div class="notif-item" data-id="${n._id}" style="padding:12px 16px; border-bottom:1px solid var(--border); cursor:pointer; ${n.read ? 'opacity:0.55;' : ''}">
            <div style="font-size:13px;">${n.message}</div>
            <div style="font-size:11px; color:var(--text-400); margin-top:3px;">${timeAgo(n.createdAt)}</div>
          </div>`
            )
            .join('')
        : `<div style="padding:24px; text-align:center; color:var(--text-400); font-size:13px;">No notifications yet.</div>`;

      panel.querySelectorAll('.notif-item').forEach((el) => {
        el.addEventListener('click', async () => {
          await PPApi.put(`/notifications/${el.dataset.id}/read`);
          loadNotifs();
        });
      });
    } catch {}
  }

  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') loadNotifs();
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.style.display = 'none';
    }
  });
  document.addEventListener('pp:notification', loadNotifs);
  loadNotifs();
}

function connectSocketForNotifications() {
  getSocket();
}
