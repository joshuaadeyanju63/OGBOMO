// ==========================================================================
// OGBOMÓ — Admin Auth Module
// Role-based access control for the admin portal.
// Roles: 'super_admin' | 'council_officer'
// Super Admin sees all LGAs. Council Officer sees their assigned LGA only.
// ==========================================================================

const AdminAuth = (() => {
  const SESSION_KEY = 'ogbomo_admin';

  // Demo credentials — replace with real API auth in production
  const DEMO_USERS = [
    {
      email: 'admin@ogbomo.ng',
      password: 'Admin@2026',
      name: 'Kielam Niedefechner',
      role: 'super_admin',
      lga: null, // sees all
      initials: 'KN'
    },
    {
      email: 'north@ogbomo.ng',
      password: 'Council@2026',
      name: 'Taiwo Adesanya',
      role: 'council_officer',
      lga: 'Ogbomosho North',
      initials: 'TA'
    },
    {
      email: 'south@ogbomo.ng',
      password: 'Council@2026',
      name: 'Bisi Olawale',
      role: 'council_officer',
      lga: 'Ogbomosho South',
      initials: 'BO'
    }
  ];

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function setSession(user) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch (_) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function isLoggedIn() { return getSession() !== null; }

  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  function isSuperAdmin() { return getRole() === 'super_admin'; }
  function isCouncilOfficer() { return getRole() === 'council_officer'; }

  function getAssignedLGA() {
    const s = getSession();
    return s ? s.lga : null;
  }

  // Attempt login — returns { success, user, error }
  function attemptLogin(email, password) {
    const found = DEMO_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (found) {
      const user = { ...found };
      delete user.password;
      setSession(user);
      return { success: true, user };
    }
    return { success: false, error: 'Incorrect email or password.' };
  }

  function logout() {
    clearSession();
    window.location.replace('admin-login.html');
  }

  // Guard — redirects to admin-login if not authenticated
  // optionally restrict to a specific role
  function protectAdminPage(requiredRole) {
    const session = getSession();
    if (!session) {
      const current = window.location.pathname.split('/').pop();
      window.location.replace(`admin-login.html?redirect=${encodeURIComponent(current)}`);
      return false;
    }
    if (requiredRole && session.role !== requiredRole) {
      // council officer trying to access super-admin-only page
      window.location.replace('admin-dashboard.html');
      return false;
    }
    return true;
  }

  // Render sidebar user info based on session
  function renderSidebarUser() {
    const user = getSession();
    if (!user) return;

    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-avatar');
    const badgeEl = document.getElementById('sidebar-role-badge');
    const badgeLabelEl = document.getElementById('sidebar-role-label');
    const lgaBadgeEl = document.getElementById('topbar-lga-badge');

    if (nameEl) nameEl.textContent = user.name;
    if (avatarEl) avatarEl.textContent = user.initials;
    if (roleEl) roleEl.textContent = user.role === 'super_admin' ? 'Super Admin' : 'Council Officer';

    if (badgeEl && badgeLabelEl) {
      if (user.role === 'super_admin') {
        badgeLabelEl.textContent = 'Super Admin';
      } else {
        badgeEl.classList.add('council');
        const dot = badgeEl.querySelector('.sidebar-role-dot');
        if (dot) dot.classList.add('council');
        badgeLabelEl.textContent = user.lga || 'Council Officer';
      }
    }

    if (lgaBadgeEl) {
      lgaBadgeEl.textContent = user.role === 'super_admin'
        ? 'All LGAs'
        : user.lga || '';
    }

    // Hide super-admin-only nav items for council officers
    if (user.role === 'council_officer') {
      document.querySelectorAll('[data-super-only]').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Attach logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  // Mark active sidebar link based on current page
  function markActiveSidebarLink() {
    const current = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === current) link.classList.add('active');
    });
  }

  return {
    getSession,
    isLoggedIn,
    isSuperAdmin,
    isCouncilOfficer,
    getRole,
    getAssignedLGA,
    attemptLogin,
    logout,
    protectAdminPage,
    renderSidebarUser,
    markActiveSidebarLink,
  };
})();