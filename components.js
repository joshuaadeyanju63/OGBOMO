// ==========================================================================
// OGBOMÓ — Shared site components (header, footer, mobile nav, FAQ toggle)
// Injected via JS rather than fetch() so pages work when opened directly
// as local files, not just from a server.
// ==========================================================================

const NAV_LINKS = [
  { href: 'index.html', label: 'Home' },
  { href: 'about.html', label: 'About' },
  { href: 'solution.html', label: 'Our Solution' },
  { href: 'education.html', label: 'Education' },
  { href: 'schedule-pickup.html', label: 'Schedule Pickup' },
  { href: 'wallet.html', label: 'Wallet' },
  { href: 'hubs.html', label: 'Hub Locator' },
  { href: 'impact.html', label: 'Impact' },
  { href: 'partners.html', label: 'Partners' },
  { href: 'blog.html', label: 'Blog' },
  { href: 'contact.html', label: 'Contact' },
  { href: 'login.html', label: 'Sign In', style: 'ghost' },
  { href: 'signup.html', label: 'Sign Up', style: 'cta' }
];

function currentPage() {
  const path = window.location.pathname.split('/').pop();
  return path === '' ? 'index.html' : path;
}

function renderHeader() {
  const mount = document.getElementById('site-header-mount');
  if (!mount) return;
  const current = currentPage();

  const linksHtml = NAV_LINKS.map(link => {
    const isActive = link.href === current;
    if (link.style === 'cta') {
      return `<a href="${link.href}" class="nav-cta${isActive ? ' active' : ''}">${link.label}</a>`;
    }
    if (link.style === 'ghost') {
      return `<a href="${link.href}" class="nav-ghost${isActive ? ' active' : ''}">${link.label}</a>`;
    }
    return `<a href="${link.href}"${isActive ? ' class="active"' : ''}>${link.label}</a>`;
  }).join('');

  mount.innerHTML = `
    <header class="site-header">
      <div class="nav-row">
        <a href="index.html" class="brand">
          <span class="brand-dots"><span class="dot dot-a"></span><span class="dot dot-b"></span><span class="dot dot-c"></span></span>
          <span class="brand-name">OGBOMỌ́</span>
        </a>
        <nav class="nav-links" id="nav-links">
          ${linksHtml}
        </nav>
        <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  `;

  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });
}

function renderFooter() {
  const mount = document.getElementById('site-footer-mount');
  if (!mount) return;

  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <span class="brand-name" style="color:#fff;">OGBOMỌ́</span>
            <p style="margin-top:0.8rem; max-width:32ch;">A digital circular economy platform for Ogbomosoland — turning waste into economic opportunity, one household at a time.</p>
          </div>
          <div class="footer-col">
            <h4>Platform</h4>
            <a href="solution.html">Our Solution</a>
            <a href="schedule-pickup.html">Schedule Pickup</a>
            <a href="wallet.html">Wallet</a>
            <a href="hubs.html">Hub Locator</a>
          </div>
          <div class="footer-col">
            <h4>Learn</h4>
            <a href="education.html">Education</a>
            <a href="impact.html">Impact</a>
            <a href="blog.html">Blog</a>
          </div>
          <div class="footer-col">
            <h4>Company</h4>
            <a href="about.html">About</a>
            <a href="partners.html">Partners</a>
            <a href="contact.html">Contact</a>
            <a href="admin-login.html" style="opacity:0.7;">Admin Login</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Ogbomọ́. A resident-facing prototype — not an official service of the Soun's palace or any local government.</span>
          <span>Ogbomosoland, Oyo State, Nigeria · <a href="admin-login.html" style="color:#8A8478;">Admin</a></span>
        </div>
      </div>
    </footer>
  `;
}

function initFaqAccordion() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  // Update nav to reflect auth state (logged-in greeting vs Sign In/Up links)
  if (typeof Auth !== 'undefined') Auth.updateNav();
  renderFooter();
  initFaqAccordion();
});