/* ProjectPulse — login & register page logic */

function saveSession(token, user) {
  localStorage.setItem('pp_token', token);
  localStorage.setItem('pp_user', JSON.stringify(user));
}

// ---------- LOGIN ----------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    try {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const data = await PPApi.post('/auth/login', { email, password });
      saveSession(data.token, data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  document.querySelectorAll('.demo-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.getElementById('email').value = chip.dataset.email;
      document.getElementById('password').value = chip.dataset.pass;
    });
  });

  const forgotLink = document.getElementById('forgotLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Contact your workspace admin to reset your password.', 'info');
    });
  }
}

// ---------- REGISTER ----------
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const passwordEl = document.getElementById('password');
  const strengthFill = document.getElementById('strengthFill');
  passwordEl.addEventListener('input', () => {
    const val = passwordEl.value;
    let score = 0;
    if (val.length >= 6) score += 1;
    if (val.length >= 10) score += 1;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score += 1;
    if (/[^A-Za-z0-9]/.test(val)) score += 1;
    const pct = (score / 4) * 100;
    strengthFill.style.width = pct + '%';
    strengthFill.style.background = pct < 50 ? 'var(--coral)' : pct < 100 ? 'var(--amber)' : 'var(--green)';
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('registerBtn');
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';
    try {
      const payload = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        password,
        phone: document.getElementById('phone').value.trim(),
        department: document.getElementById('department').value.trim(),
        role: document.getElementById('role').value,
      };
      const data = await PPApi.post('/auth/register', payload);
      saveSession(data.token, data.user);
      showToast('Account created! Redirecting…', 'success');
      setTimeout(() => (window.location.href = 'dashboard.html'), 600);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}
