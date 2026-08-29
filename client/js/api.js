/* ProjectPulse — API helper. Wraps fetch with auth header + JSON handling. */
const API_BASE = '/api';

const PPApi = {
  token() {
    return localStorage.getItem('pp_token');
  },
  currentUser() {
    try {
      return JSON.parse(localStorage.getItem('pp_user') || 'null');
    } catch {
      return null;
    }
  },
  logout() {
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_user');
    window.location.href = 'login.html';
  },
  async request(method, path, body, isForm = false) {
    const headers = {};
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isForm) headers['Content-Type'] = 'application/json';

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (res.status === 401) {
      this.logout();
      throw new Error(data.message || 'Session expired');
    }

    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  },
  get(path) {
    return this.request('GET', path);
  },
  post(path, body, isForm) {
    return this.request('POST', path, body, isForm);
  },
  put(path, body) {
    return this.request('PUT', path, body);
  },
  del(path) {
    return this.request('DELETE', path);
  },
};

function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function requireAuth() {
  if (!PPApi.token()) {
    window.location.href = 'login.html';
  }
}

function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

function deadlineLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return { text: 'No deadline', cls: 'badge-neutral' };
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, cls: 'badge-red' };
  if (d === 0) return { text: 'Due today', cls: 'badge-yellow' };
  if (d <= 3) return { text: `${d}d remaining`, cls: 'badge-yellow' };
  return { text: `${d}d remaining`, cls: 'badge-neutral' };
}
