/* ProjectPulse — Socket.IO client singleton */
let ppSocket = null;

function getSocket() {
  if (ppSocket) return ppSocket;
  const token = PPApi.token();
  if (!token) return null;

  ppSocket = io({ auth: { token } });

  ppSocket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  // Global notification toast — fires regardless of which page is open
  ppSocket.on('notification', (n) => {
    showToast(n.message, 'info');
    document.dispatchEvent(new CustomEvent('pp:notification', { detail: n }));
  });

  return ppSocket;
}
