// ==========================================================================
// OGBOMÓ — Data Store Module
// Persists reports and CleanPoints wallet data using localStorage, so both
// survive page reloads and are shared between the resident-facing pages
// and the admin portal (both read/write the same keys).
//
// In a production deployment, replace these localStorage calls with real
// API calls to a backend database — the function signatures below are
// deliberately kept simple so that swap is mechanical, not a rewrite.
// ==========================================================================

const OgbomoStore = (() => {
  const REPORTS_KEY = 'ogbomo_reports';
  const WALLET_KEY  = 'ogbomo_wallets'; // { [email]: { balance, transactions: [] } }

  // ── Generic storage helpers ─────────────────────────────────────────────

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (err) {
      // Most likely cause: localStorage quota exceeded (e.g. too many
      // uncompressed photos). Surface this rather than failing silently.
      console.warn('OgbomoStore: failed to save', key, err);
      return false;
    }
  }

  // ── Photo compression ────────────────────────────────────────────────────
  // Resizes + re-encodes an uploaded photo client-side before storing it,
  // so a single report doesn't consume several MB of localStorage's ~5MB
  // budget. Returns a Promise resolving to a compressed data URL, or null
  // if no file was provided.

  function compressPhoto(file, maxWidth = 640, quality = 0.6) {
    return new Promise((resolve) => {
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // ── Reports ──────────────────────────────────────────────────────────────

  function getAllReports() {
    return readJSON(REPORTS_KEY, []);
  }

  function getReportsByUser(email) {
    return getAllReports().filter(r => r.userEmail === email);
  }

  function getReportsByLGA(lga) {
    return getAllReports().filter(r => r.lga === lga);
  }

  // Creates a report. `photoFile` is an optional File object from an
  // <input type="file">; it will be compressed before saving.
  async function createReport({ userEmail, userName, lga, type, stream, location, description, photoFile }) {
    const photoDataUrl = await compressPhoto(photoFile);
    const reports = getAllReports();
    const id = 'OGB-' + (5000 + reports.length + Math.floor(Math.random() * 100));
    const report = {
      id,
      userEmail,
      userName: userName || (userEmail ? userEmail.split('@')[0] : 'Resident'),
      lga: lga || 'Unspecified',
      type,
      stream,
      location,
      description,
      photoDataUrl: photoDataUrl || null,
      status: 'open', // open | review | resolved
      filedAt: new Date().toISOString(),
    };
    reports.unshift(report);
    writeJSON(REPORTS_KEY, reports);
    return report;
  }

  function updateReportStatus(id, newStatus) {
    const reports = getAllReports();
    const report = reports.find(r => r.id === id);
    if (report) {
      report.status = newStatus;
      writeJSON(REPORTS_KEY, reports);
    }
    return report || null;
  }

  // ── Wallet / CleanPoints ─────────────────────────────────────────────────

  function getAllWallets() {
    return readJSON(WALLET_KEY, {});
  }

  function getWallet(email) {
    const wallets = getAllWallets();
    return wallets[email] || { balance: 0, transactions: [] };
  }

  function addPoints(email, { material, kg, points, hub }) {
    const wallets = getAllWallets();
    if (!wallets[email]) wallets[email] = { balance: 0, transactions: [] };
    wallets[email].balance += points;
    wallets[email].transactions.unshift({
      date: new Date().toISOString(),
      material, kg, points,
      hub: hub || 'Self-reported drop-off',
    });
    writeJSON(WALLET_KEY, wallets);
    return wallets[email];
  }

  function redeemPoints(email, amount) {
    const wallets = getAllWallets();
    if (!wallets[email] || wallets[email].balance < amount) return null;
    wallets[email].balance -= amount;
    wallets[email].transactions.unshift({
      date: new Date().toISOString(),
      material: 'redemption',
      points: -amount,
      hub: 'Cash redemption',
    });
    writeJSON(WALLET_KEY, wallets);
    return wallets[email];
  }

  return {
    // reports
    getAllReports, getReportsByUser, getReportsByLGA, createReport, updateReportStatus,
    // wallet
    getWallet, addPoints, redeemPoints,
    // exposed for advanced/debug use
    compressPhoto,
  };
})();