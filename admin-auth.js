// ==========================================================================
// OGBOMỌ́ — Admin Auth Module
// Role-based access control for the staff side of the platform.
//
// ROLES
//   super_admin      — all LGAs, plus Finance and Users pages
//   lga_admin        — ONE LGA: reports, routes, crews, team overview
//   council_officer  — ONE LGA: triage reports, assign work to crews
//   collector        — a crew member: sees only their own jobs (collector.html)
//
// DEMO ONLY: accounts below are hardcoded and checked in the browser, so any
// technical user can bypass them. A production system must authenticate and
// authorise on a server (see docs/10-v2-architecture.md).
// ==========================================================================

const AdminAuth = (() => {
  const SESSION_KEY = 'ogbomo_admin';

  const ROLE_LABEL = {
    super_admin: 'Super Admin',
    lga_admin: 'LGA Admin',
    council_officer: 'Council Officer',
    collector: 'Collector',
  };

  // Demo credentials — replace with real API auth in production
  const DEMO_USERS = [
    { email: 'admin@ogbomo.ng',    password: 'Admin@2026',   name: 'Kielam Niedefechner', role: 'super_admin',     lga: null,               initials: 'KN' },

    // LGA Admin (one demo account, Ogbomosho North)
    { email: 'lgaadmin.north@ogbomo.ng', password: 'Lga@2026', name: 'Folake Ajayi',     role: 'lga_admin',       lga: 'Ogbomosho North',  initials: 'FA' },

    // Council officers — one per LGA
    { email: 'north@ogbomo.ng',    password: 'Council@2026', name: 'Taiwo Adesanya',    role: 'council_officer', lga: 'Ogbomosho North',  initials: 'TA' },
    { email: 'south@ogbomo.ng',    password: 'Council@2026', name: 'Bisi Olawale',      role: 'council_officer', lga: 'Ogbomosho South',  initials: 'BO' },
    { email: 'oriire@ogbomo.ng',   password: 'Council@2026', name: 'Kunle Fasasi',      role: 'council_officer', lga: 'Oriire',           initials: 'KF' },
    { email: 'ogooluwa@ogbomo.ng', password: 'Council@2026', name: 'Ronke Adebayo',     role: 'council_officer', lga: 'Ogo-Oluwa',        initials: 'RA' },
    { email: 'surulere@ogbomo.ng', password: 'Council@2026', name: 'Dayo Ogunleye',     role: 'council_officer', lga: 'Surulere',         initials: 'DO' },

    // Collectors — each belongs to a crew (see OgbomoStore.CREWS)
    { email: 'crew.a@ogbomo.ng',   password: 'Crew@2026',    name: 'Segun Alabi',       role: 'collector', lga: 'Ogbomosho North', crewId: 'crew-a', initials: 'SA' },
    { email: 'crew.b@ogbomo.ng',   password: 'Crew@2026',    name: 'Wale Ibitoye',      role: 'collector', lga: 'Ogbomosho North', crewId: 'crew-b', initials: 'WI' },
    { email: 'crew.c@ogbomo.ng',   password: 'Crew@2026',    name: 'Lanre Oyebanji',    role: 'collector', lga: 'Ogbomosho South', crewId: 'crew-c', initials: 'LO' },
    { email: 'crew.d@ogbomo.ng',   password: 'Crew@2026',    name: 'Tunde Akande',      role: 'collector', lga: 'Ogbomosho North', crewId: 'crew-d', initials: 'TA' },
    { email: 'crew.e@ogbomo.ng',   password: 'Crew@2026',    name: 'Gbenga Ojo',        role: 'collector', lga: 'Oriire',          crewId: 'crew-e', initials: 'GO' },
    { email: 'crew.f@ogbomo.ng',   password: 'Crew@2026',    name: 'Muyiwa Salami',     role: 'collector', lga: 'Ogo-Oluwa',       crewId: 'crew-f', initials: 'MS' },
    { email: 'crew.g@ogbomo.ng',   password: 'Crew@2026',    name: 'Femi Adigun',       role: 'collector', lga: 'Surulere',        crewId: 'crew-g', initials: 'FA' },
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
  function isLgaAdmin() { return getRole() === 'lga_admin'; }
  function isCouncilOfficer() { return getRole() === 'council_officer'; }
  function isCollector() { return getRole() === 'collector'; }

  function getAssignedLGA() {
    const s = getSession();
    return s ? s.lga : null;
  }

  function getCrewId() {
    const s = getSession();
    return s && s.crewId ? s.crewId : null;
  }

  // Where each role lands after signing in
  function homePage(role) {
    return role === 'collector' ? 'collector.html' : 'admin-dashboard.html';
  }

  // Public staff directory (no passwords) — for the Team page
  function listStaff() {
    return DEMO_USERS.map(u => {
      const c = { ...u };
      delete c.password;
      return c;
    });
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

  // Guard — redirects to admin-login if not authenticated.
  // requiredRole: undefined = any STAFF role (collectors are sent to their own page),
  //               string    = exactly that role,
  //               array     = any of these roles.
  function protectAdminPage(requiredRole) {
    const session = getSession();
    if (!session) {
      const current = window.location.pathname.split('/').pop();
      window.location.replace(`admin-login.html?redirect=${encodeURIComponent(current)}`);
      return false;
    }
    let allowed;
    if (!requiredRole) allowed = session.role !== 'collector';
    else if (Array.isArray(requiredRole)) allowed = requiredRole.includes(session.role);
    else allowed = session.role === requiredRole;

    if (!allowed) {
      window.location.replace(homePage(session.role));
      return false;
    }
    return true;
  }

  // Guard for collector.html
  function protectCollectorPage() {
    const session = getSession();
    if (!session) {
      window.location.replace('admin-login.html?redirect=collector.html');
      return false;
    }
    if (session.role !== 'collector') {
      window.location.replace(homePage(session.role));
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
    if (roleEl) roleEl.textContent = ROLE_LABEL[user.role] || user.role;

    if (badgeEl && badgeLabelEl) {
      if (user.role === 'super_admin') {
        badgeLabelEl.textContent = 'Super Admin';
      } else {
        badgeEl.classList.add('council');
        const dot = badgeEl.querySelector('.sidebar-role-dot');
        if (dot) dot.classList.add('council');
        badgeLabelEl.textContent = (ROLE_LABEL[user.role] || 'Staff') + (user.lga ? ' · ' + user.lga : '');
      }
    }

    if (lgaBadgeEl) {
      lgaBadgeEl.textContent = user.role === 'super_admin' ? 'All LGAs' : (user.lga || '');
    }

    // Hide super-admin-only nav items for everyone else
    if (user.role !== 'super_admin') {
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
    ROLE_LABEL,
    getSession,
    isLoggedIn,
    isSuperAdmin,
    isLgaAdmin,
    isCouncilOfficer,
    isCollector,
    getRole,
    getAssignedLGA,
    getCrewId,
    homePage,
    listStaff,
    attemptLogin,
    logout,
    protectAdminPage,
    protectCollectorPage,
    renderSidebarUser,
    markActiveSidebarLink,
  };
})();

// ── Shared admin sidebar ─────────────────────────────────────────────────
// One role-aware sidebar for every admin page (replaces five duplicated copies).
function buildSidebar(active) {
  const role = AdminAuth.getRole();
  const s = role === 'super_admin';
  const teamAllowed = role === 'super_admin' || role === 'lga_admin';
  const link = (key, href, icon, label, extra) =>
    `<a href="${href}" class="sidebar-link ${active === key ? 'active' : ''}"><span class="icon">${icon}</span>${label}${extra || ''}</a>`;
  return `
  <div class="sidebar-brand">
    <div class="sidebar-brand-name">OGBOMỌ́</div>
    <div class="sidebar-brand-sub">Admin Portal</div>
  </div>
  <div id="sidebar-role-badge" class="sidebar-role-badge ${s ? '' : 'council'}">
    <span class="sidebar-role-dot"></span>
    <span id="sidebar-role-label">${AdminAuth.ROLE_LABEL[role] || 'Staff'}</span>
  </div>
  <nav class="sidebar-nav">
    <div class="sidebar-section-label">Overview</div>
    ${link('dashboard', 'admin-dashboard.html', '◼', 'Dashboard')}
    <div class="sidebar-section-label">Operations</div>
    ${link('reports', 'admin-reports.html', '🎫', 'Reports', '<span class="notif-dot"></span>')}
    ${link('routes', 'admin-routes.html', '🚛', 'Routes & Crews')}
    ${teamAllowed ? link('team', 'admin-team.html', '🧑‍🤝‍🧑', 'Team & Workload') : ''}
    ${s ? `<div class="sidebar-section-label">Finance</div>
    ${link('wallet', 'admin-wallet.html', '💰', 'CleanPoints & Wallet')}
    <div class="sidebar-section-label">Platform</div>
    ${link('users', 'admin-users.html', '👥', 'Users')}` : ''}
    <div class="sidebar-section-label">Account</div>
    <a href="index.html" class="sidebar-link"><span class="icon">↗</span>Public Site</a>
  </nav>
  <div class="sidebar-footer">
    <div class="sidebar-user">
      <div class="sidebar-avatar" id="sidebar-avatar">KN</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-name" id="sidebar-user-name">Loading…</div>
        <div class="sidebar-user-role" id="sidebar-user-role"></div>
      </div>
    </div>
    <button class="sidebar-logout" id="sidebar-logout-btn">Sign out</button>
  </div>`;
}
