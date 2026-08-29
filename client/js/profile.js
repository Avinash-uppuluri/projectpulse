/* ProjectPulse — Profile & settings page */
requireAuth();

document.addEventListener('DOMContentLoaded', async () => {
  renderShell('profile.html');

  const user = PPApi.currentUser();
  document.getElementById('profileAvatar').textContent = initials(user.name);
  document.getElementById('profileName').textContent = user.name;
  document.getElementById('profileRole').textContent = user.role;
  document.getElementById('pr_name').value = user.name;
  document.getElementById('pr_email').value = user.email;
  document.getElementById('pr_phone').value = user.phone || '';
  document.getElementById('pr_department').value = user.department || '';

  document.getElementById('profileThemeToggle').addEventListener('click', () => {
    document.getElementById('themeToggle').click();
  });

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const updated = await PPApi.put(`/users/${user._id}`, {
        name: document.getElementById('pr_name').value.trim(),
        phone: document.getElementById('pr_phone').value.trim(),
        department: document.getElementById('pr_department').value.trim(),
      });
      const stored = PPApi.currentUser();
      const merged = { ...stored, ...updated };
      localStorage.setItem('pp_user', JSON.stringify(merged));
      document.getElementById('profileName').textContent = merged.name;
      document.getElementById('profileAvatar').textContent = initials(merged.name);
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await PPApi.put(`/users/${user._id}/password`, {
        currentPassword: document.getElementById('pw_current').value,
        newPassword: document.getElementById('pw_new').value,
      });
      document.getElementById('passwordForm').reset();
      showToast('Password updated successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  try {
    const [tasks, projects] = await Promise.all([
      PPApi.get(`/tasks?assignedTo=${user._id}`),
      PPApi.get('/projects'),
    ]);
    document.getElementById('statAssigned').textContent = tasks.length;
    document.getElementById('statCompleted').textContent = tasks.filter((t) => t.status === 'Completed').length;
    const myProjects = projects.filter(
      (p) => p.manager?._id === user._id || (p.teamMembers || []).some((m) => m._id === user._id)
    );
    document.getElementById('statProjects').textContent = myProjects.length;
  } catch {
    // Non-critical — leave placeholders.
  }
});
