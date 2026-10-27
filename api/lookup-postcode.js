// ==========================================================================
// OGBOMỌ́ — Nigeria Postcode Lookup (Vercel Serverless Function)
// Route: GET /api/lookup-postcode?code=EK-01-A03-FK-01
//
// WHY THIS IS A SERVER FUNCTION: the NIPOST postcode API key is a secret key
// and must never reach the browser. This function holds it (Vercel env var
// POSTCODE_API_KEY) and the browser only ever talks to this endpoint.
//
// WHAT IT DOES
//  1. Normalises and format-checks the code locally (no API call for junk).
//  2. Splits it into segments (state / LGA / district / area / unit).
//  3. Resolves state + LGA NAMES from the free reference endpoints
//     (/v1/reference/states, /v1/reference/lgas) — no credits used.
//  4. Best-effort free Level-1 validity check (/v1/lookup?level=1).
//  5. Reports whether the LGA is one of Ogbomosoland's five LGAs.
//
// The result is a SUGGESTION for the report form; the resident can override.
// Format reference: https://docs.postcode.gov.ng/concepts/postcode-format.md
// ==========================================================================

const BASE_URL = 'https://api.postcode.gov.ng';
const TIMEOUT_MS = 8000;
const REF_TTL_MS = 24 * 60 * 60 * 1000; // reference data rarely changes

// AA 99 H77 BB 55  → state(2 letters) lga(2 digits) district(3 alnum) area(2 letters) unit(2 digits)
const COMPACT_RE = /^([A-Z]{2})(\d{2})([A-Z0-9]{3})([A-Z]{2})(\d{2})$/;

// The five Ogbomosoland LGAs, matched loosely against the names the API returns.
const OGBOMO_LGAS = [
  { name: 'Ogbomosho North', test: n => /OGBOMO/.test(n) && /NORTH/.test(n) },
  { name: 'Ogbomosho South', test: n => /OGBOMO/.test(n) && /SOUTH/.test(n) },
  { name: 'Oriire',          test: n => /ORIIRE|ORIRE/.test(n) },
  { name: 'Ogo-Oluwa',       test: n => /OGO.?OLUWA/.test(n) },
  { name: 'Surulere',        test: n => /SURULERE/.test(n) },
];

// ── tiny in-memory caches (per warm serverless instance; best-effort) ──────
let statesCache = null;           // { at, list }
const lgaCache = new Map();       // stateCode -> { at, list }
const rate = new Map();           // ip -> { count, resetAt }
const RATE_MAX = 30;              // lookups per IP per minute (best-effort only)

function rateLimited(ip) {
  const now = Date.now();
  const r = rate.get(ip);
  if (!r || r.resetAt < now) { rate.set(ip, { count: 1, resetAt: now + 60000 }); return false; }
  r.count += 1;
  if (rate.size > 5000) rate.clear(); // keep memory bounded
  return r.count > RATE_MAX;
}

function normalise(raw) {
  const compact = String(raw || '').toUpperCase().replace(/[\s-]+/g, '');
  const m = compact.match(COMPACT_RE);
  if (!m) return null;
  const [, state, lga, district, area, unit] = m;
  return { state, lga, district, area, unit, canonical: [state, lga, district, area, unit].join('-') };
}

class UpstreamError extends Error {
  constructor(status, code) { super(code || 'upstream_error'); this.status = status; this.code = code; }
}

async function nipost(path, apiKey) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(BASE_URL + path, {
  headers: {
    'X-API-Key': apiKey,
    Accept: 'application/json',
  },
  signal: ctrl.signal,
});

console.log('POSTCODE API DIAGNOSTIC', {
  path,
  status: resp.status,
  ok: resp.ok,
});

let body = null;
try {
  body = await resp.json();
} catch (_) {
  // Response body was not JSON.
}
    
if (!resp.ok) {
  const code = body && body.error && body.error.code;

  console.error('Postcode upstream response:', {
    path,
    status: resp.status,
    code: code || null,
    // Log only a sanitized response, never credentials.
    response: body && body.error
      ? body.error
      : null,
  });

  throw new UpstreamError(resp.status, code);
}

    return body;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(err.name === 'AbortError' ? 504 : 502, 'network');
  } finally {
    clearTimeout(timer);
  }
}

async function getStates(apiKey) {
  if (statesCache && Date.now() - statesCache.at < REF_TTL_MS) return statesCache.list;
  const body = await nipost('/v1/reference/states', apiKey);
  const list = (body && body.data && body.data.states) || [];
  statesCache = { at: Date.now(), list };
  return list;
}

async function getLgas(stateCode, apiKey) {
  const hit = lgaCache.get(stateCode);
  if (hit && Date.now() - hit.at < REF_TTL_MS) return hit.list;
  const body = await nipost('/v1/reference/lgas?state=' + encodeURIComponent(stateCode), apiKey);
  const list = (body && body.data && body.data.lgas) || [];
  lgaCache.set(stateCode, { at: Date.now(), list });
  return list;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  const apiKey = process.env.POSTCODE_API_KEY;
  if (!apiKey) {
    console.error('POSTCODE_API_KEY is not set in environment variables.');
    res.status(500).json({ error: 'Postcode lookup is not available right now. You can still file your report without it.' });
    return;
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'Too many lookups. Please wait a minute and try again.' });
    return;
  }

  const parts = normalise(req.query && req.query.code);
  if (!parts) {
    res.status(400).json({
      error: 'That doesn\'t look like a postcode. It has 11 characters, like EK-01-A03-FK-01.',
    });
    return;
  }

  try {
    // 1) State + LGA names from free reference data
    const states = await getStates(apiKey);
    const state = states.find(s => s.code === parts.state);
    if (!state) {
      res.status(404).json({ error: 'No state matches the start of that postcode. Please check it.' });
      return;
    }
    const lgas = await getLgas(parts.state, apiKey);
    const lga = lgas.find(l => l.code === parts.lga);
    if (!lga) {
      res.status(404).json({ error: 'No local government matches that postcode. Please check it.' });
      return;
    }

    
    // 2) Best-effort Level 1 validity check
    let verified = null; // true | false | null (unknown)

    try {
      const v = await nipost(
        '/v1/lookup?level=1&code=' +
          encodeURIComponent(parts.canonical),
        apiKey
      );

      console.log('POSTCODE LOOKUP RESPONSE', {
  postcode: v?.data?.postcode ?? null,
  valid: v?.data?.valid ?? null,
  status: v?.data?.status ?? null,
  verified: v?.data?.verified ?? null,
});

      if (v && v.data && typeof v.data.valid === 'boolean') {
        verified = v.data.valid;
      } else {
        console.warn('Unexpected postcode lookup response shape');
      }
    } catch (err) {
      // Log diagnostic information, never the API key.
      console.warn('Level 1 postcode lookup error:', {
        status: err.status,
        code: err.code,
      });

      // Don't classify an ambiguous upstream error as invalid.
      // Confirm the official API's documented 404 semantics first.
      verified = null;
    }


    // 3) Is it one of Ogbomosoland's five LGAs?
    const lgaName = String(lga.name || '');
    const ogbomo = OGBOMO_LGAS.find(o => o.test(lgaName.toUpperCase()));

    res.status(200).json({
      postcode: parts.canonical,
      state: { code: state.code, name: state.name || null },
      lga: { code: lga.code, name: lgaName || null },
      ogbomoLga: ogbomo ? ogbomo.name : null,   // canonical Ogbomọ́ LGA name, or null
      verified, // true = valid; false = not found; null = unable to verify
    });
  } catch (err) {
    console.error('Postcode lookup failed:', err.status, err.code); // never log the key
    if (err.status === 429) {
      res.status(503).json({ error: 'The postcode service is busy. Please try again shortly, or file without it.' });
    } else if (err.status === 401 || err.status === 403) {
      res.status(500).json({ error: 'Postcode lookup is not available right now. You can still file your report without it.' });
    } else {
      res.status(502).json({ error: 'Could not reach the postcode service. You can still file your report without it.' });
    }
  }
};


