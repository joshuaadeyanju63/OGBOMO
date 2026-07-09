// ==========================================================================
// OGBOMÓ — Auth Module
// Simulates a real authentication layer using sessionStorage.
// In a production deployment, replace the session check with a real
// API call (JWT validation, Firebase Auth, etc.).
//
// HOW IT WORKS:
//   - "Logged in" state is stored in sessionStorage under 'ogbomo_user'
//   - protectPage() checks that state on load; redirects to signup if absent
//   - After login/signup, ?redirect= param returns the user to their page
//   - Nav updates dynamically to show correct auth state
// ==========================================================================

const Auth = (() => {
  const SESSION_KEY = 'ogbomo_user';

  // ── Core session helpers ────────────────────────────────────────────────

  function getUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function setUser(data) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function clearUser() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function isLoggedIn() {
    return getUser() !== null;
  }

  // ── Redirect helpers ────────────────────────────────────────────────────

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || null;
  }

  function buildAuthUrl(page, intendedUrl) {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    const target = intendedUrl || current;
    return `${page}?redirect=${encodeURIComponent(target)}`;
  }

  // ── Page guard ──────────────────────────────────────────────────────────
  // Call on any page that requires authentication.
  // Redirects to signup, preserving the current page as ?redirect=

  function protectPage() {
    if (!isLoggedIn()) {
      const current = window.location.pathname.split('/').pop() || 'index.html';
      window.location.replace(buildAuthUrl('signup.html', current));
      return false;
    }
    return true;
  }

  // ── Login / Signup simulation ───────────────────────────────────────────
  // Call these from your form submit handlers.

  function login(email, name) {
    setUser({ email, name: name || email.split('@')[0], loggedIn: true, ts: Date.now() });
    const redirect = getRedirectTarget();
    window.location.replace(redirect || 'index.html');
  }

  function signup(firstName, lastName, email, lga) {
    setUser({ email, name: firstName + ' ' + lastName, lga, loggedIn: true, ts: Date.now() });
    const redirect = getRedirectTarget();
    window.location.replace(redirect || 'index.html');
  }

  function logout() {
    clearUser();
    window.location.replace('index.html');
  }

  // ── Nav update ──────────────────────────────────────────────────────────
  // Swaps Sign In / Sign Up for a user greeting + Log Out in the nav.
  // Call after renderHeader() in components.js has run.

  function updateNav() {
    const user = getUser();
    const navLinks = document.getElementById('nav-links');
    if (!navLinks) return;

    const signIn = navLinks.querySelector('a[href="login.html"]');
    const signUp = navLinks.querySelector('a[href="signup.html"]');

    if (user) {
      // Replace both auth links with greeting + logout
      if (signIn) signIn.remove();
      if (signUp) {
        const firstName = user.name ? user.name.split(' ')[0] : 'You';
        signUp.outerHTML = `
          <span class="nav-user-greeting">Ẹ káàbọ̀, ${firstName}</span>
          <button class="nav-logout-btn" id="nav-logout-btn">Log out</button>
        `;
        const btn = document.getElementById('nav-logout-btn');
        if (btn) btn.addEventListener('click', logout);
      }
    }
  }

  // ── Auth page redirects ─────────────────────────────────────────────────
  // Call on login.html and signup.html — if user is already logged in,
  // skip straight to the destination.

  function redirectIfLoggedIn() {
    if (isLoggedIn()) {
      const redirect = getRedirectTarget();
      window.location.replace(redirect || 'index.html');
    }
  }

  return {
    getUser,
    isLoggedIn,
    protectPage,
    login,
    signup,
    logout,
    updateNav,
    redirectIfLoggedIn,
    getRedirectTarget,
    buildAuthUrl,
  };
})();