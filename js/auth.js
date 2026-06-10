/* ============================================================
   LYCEUM CONNECT — CLIENT-SIDE AUTHENTICATION GATE
   ============================================================ */

'use strict';

(function() {
  const sessionActive = localStorage.getItem('lc-auth-session') === 'true';
  // Match both "/login.html" and Cloudflare Pages' clean URL "/login"
  const isLoginPage = /\/login(\.html)?$/.test(window.location.pathname);

  if (!sessionActive && !isLoginPage) {
    // Force redirect to login page
    window.location.href = 'login.html';
  } else if (sessionActive && isLoginPage) {
    // User already logged in, redirect to home page
    window.location.href = 'index.html';
  }
})();

// Clear login session and redirect to login page
function logoutSession() {
  localStorage.removeItem('lc-auth-session');
  window.location.href = 'login.html';
}
