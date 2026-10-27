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
  const JOBS_KEY    = 'ogbomo_assignments'; // [ job, ... ] — report-to-crew assignments

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
  async function createReport({ userEmail, userName, lga, type, stream, location, description, photoFile, postcode }) {
    const photoDataUrl = await compressPhoto(photoFile);
    const reports = getAllReports();
    const id = 'OGB-' + (5000 + reports.length + Math.floor(Math.random() * 100));
    const report = {
      id,
      userEmail,
      userName: userName || (userEmail ? userEmail.split('@')[0] : 'Resident'),
      lga: lga || 'Unspecified',
      postcode: postcode || null, // NIPOST postcode (optional), e.g. 'EK-01-A03-FK-01'
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

  // ── Crews & job assignments ──────────────────────────────────────────────
  // DEMO: crews are a fixed list; assignments live in this browser only, so a
  // collector sees jobs assigned from the same browser. A real deployment
  // needs a shared database (docs/05-data-model.md: Crew, DispatchJob).
  //
  // job = { reportId, type, stream, location, lga, description,
  //         crewId, status: 'assigned'|'progress'|'collected'|'issue',
  //         issueReason, note, assignedBy, assignedAt, updatedAt, updatedBy }
  const CREWS = [
    { id: 'crew-a', name: 'Crew A', lga: 'Ogbomosho North' },
    { id: 'crew-b', name: 'Crew B', lga: 'Ogbomosho North' },
    { id: 'crew-d', name: 'Crew D', lga: 'Ogbomosho North' },
    { id: 'crew-c', name: 'Crew C', lga: 'Ogbomosho South' },
    { id: 'crew-e', name: 'Crew E', lga: 'Oriire' },
    { id: 'crew-f', name: 'Crew F', lga: 'Ogo-Oluwa' },
    { id: 'crew-g', name: 'Crew G', lga: 'Surulere' },
  ];
  const JOB_STATUSES = ['assigned', 'progress', 'collected', 'issue'];

  function getCrews(lga) {
    return lga ? CREWS.filter(c => c.lga === lga) : CREWS.slice();
  }

  function getCrew(id) {
    return CREWS.find(c => c.id === id) || null;
  }

  function getAllJobs() {
    return readJSON(JOBS_KEY, []);
  }

  function getJobsByCrew(crewId) {
    return getAllJobs().filter(j => j.crewId === crewId);
  }

  function getJobForReport(reportId) {
    return getAllJobs().find(j => j.reportId === reportId) || null;
  }

  // Assign (or re-assign) a report to a crew. `report` needs id, type, stream,
  // location, lga (+ optional description). Re-assigning resets status to 'assigned'.
  function assignReport(report, crewId, byName) {
    const crew = getCrew(crewId);
    if (!report || !report.id || !crew) return null;
    if (report.lga && crew.lga !== report.lga) return null; // crews work in their own LGA only
    const jobs = getAllJobs();
    const now = new Date().toISOString();
    let job = jobs.find(j => j.reportId === report.id);
    if (!job) {
      job = { reportId: report.id, assignedAt: now };
      jobs.unshift(job);
    }
    Object.assign(job, {
      type: report.type || '', stream: report.stream || '', location: report.location || '',
      lga: report.lga || crew.lga, description: report.description || '',
      crewId, status: 'assigned', issueReason: '', note: '',
      assignedBy: byName || 'Officer', assignedAt: now, updatedAt: now, updatedBy: byName || 'Officer',
    });
    writeJSON(JOBS_KEY, jobs);
    return job;
  }

  function unassignReport(reportId) {
    const jobs = getAllJobs().filter(j => j.reportId !== reportId);
    writeJSON(JOBS_KEY, jobs);
  }

  // Collector (or officer) updates a job. `extra` may carry { issueReason, note }.
  function updateJobStatus(reportId, status, byName, extra) {
    if (!JOB_STATUSES.includes(status)) return null;
    const jobs = getAllJobs();
    const job = jobs.find(j => j.reportId === reportId);
    if (!job) return null;
    job.status = status;
    job.updatedAt = new Date().toISOString();
    job.updatedBy = byName || '';
    job.issueReason = status === 'issue' ? ((extra && extra.issueReason) || '') : '';
    job.note = (extra && extra.note) || '';
    writeJSON(JOBS_KEY, jobs);
    return job;
  }

  // Minimal HTML escaping for any user-supplied text put into innerHTML.
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return {
    // reports
    getAllReports, getReportsByUser, getReportsByLGA, createReport, updateReportStatus,
    // wallet
    getWallet, addPoints, redeemPoints,
    // crews & jobs (demo)
    CREWS, getCrews, getCrew, getAllJobs, getJobsByCrew, getJobForReport,
    assignReport, unassignReport, updateJobStatus,
    // helpers
    esc,
    // exposed for advanced/debug use
    compressPhoto,
  };
})();
