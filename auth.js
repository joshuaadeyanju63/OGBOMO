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
  const USERS_KEY = 'ogbomo_registered_users'; // persisted across tabs/reloads via localStorage

  // ── Registered users store (localStorage — persists across tabs/reloads) ─
  // NOTE: this is a static-frontend prototype with no backend, so accounts
  // are stored in the browser only, in plain form. A real deployment must
  // replace this entirely with a server-side database and hashed passwords.

  function getRegisteredUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveRegisteredUsers(list) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function findUserByEmail(email) {
    return getRegisteredUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  function registerUser({ firstName, lastName, email, lga, password }) {
    const users = getRegisteredUsers();
    if (findUserByEmail(email)) {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    users.push({ firstName, lastName, email, lga, password, createdAt: Date.now() });
    saveRegisteredUsers(users);
    return { ok: true };
  }

  // Checks email + password against the registered users list.
  // Returns the matching user record, or null if no match.
  function checkCredentials(email, password) {
    const user = findUserByEmail(email);
    if (!user) return null;
    if (user.password !== password) return null;
    return user;
  }

  // Updates the stored password for an existing account.
  // Returns { ok: true } if found and updated, { ok: false } if no such account.
  // Note: intentionally does not reveal *why* it failed to the caller by
  // default — real reset-link flows shouldn't confirm whether an email
  // is registered. Callers can choose how much to surface to the user.
  function updatePassword(email, newPassword) {
    const users = getRegisteredUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return { ok: false };
    users[idx].password = newPassword;
    saveRegisteredUsers(users);
    return { ok: true };
  }

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

  // Returns { ok: true } and creates a session on success,
  // or { ok: false, error } if the email/password don't match a real account.
  function login(email, password) {
    const user = checkCredentials(email, password);
    if (!user) {
      return { ok: false, error: 'Incorrect email or password. Please check your details, or sign up if you don\'t have an account yet.' };
    }
    setUser({
      email: user.email,
      name: user.firstName + ' ' + user.lastName,
      lga: user.lga,
      loggedIn: true,
      ts: Date.now()
    });
    const redirect = getRedirectTarget();
    window.location.replace(redirect || 'index.html');
    return { ok: true };
  }

  // Returns { ok: true } and creates the account + session on success,
  // or { ok: false, error } if an account with that email already exists.
  function signup(firstName, lastName, email, lga, password) {
    const result = registerUser({ firstName, lastName, email, lga, password });
    if (!result.ok) return result;

    setUser({ email, name: firstName + ' ' + lastName, lga, loggedIn: true, ts: Date.now() });
    const redirect = getRedirectTarget();
    window.location.replace(redirect || 'index.html');
    return { ok: true };
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
    checkCredentials,
    findUserByEmail,
  };
})();
