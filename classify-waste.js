// ==========================================================================
// OGBOMÓ — AI Waste Sorting Classifier (Vercel Serverless Function)
// Route: POST /api/classify-waste
//
// WHY THIS FILE EXISTS AS A SERVERLESS FUNCTION AND NOT CLIENT-SIDE JS:
// The Anthropic API key must never be shipped to the browser — anyone
// viewing page source or the Network tab could steal it and rack up
// charges on your account. This function runs on Vercel's servers, reads
// the key from an environment variable (set in the Vercel dashboard, never
// committed to the repo), and is the only place the key ever exists.
// The browser only ever talks to THIS endpoint, never to Anthropic directly.
//
// SETUP (do this once in the Vercel dashboard, not in code):
//   Project Settings → Environment Variables → add:
//     ANTHROPIC_API_KEY = sk-ant-xxxxxxxx...
//   Redeploy after adding it. See .env.example for local dev.
// ==========================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5'; // swap to 'claude-haiku-4-5-20251001' for lower cost/latency

// The 4 bin categories this platform actually supports — kept as a single
// source of truth so the prompt and the frontend rendering logic agree.
const VALID_CATEGORIES = ['organic', 'plastic', 'paper', 'metal'];

const SYSTEM_PROMPT = `You are a waste-sorting assistant for Ogbomọ́, a civic platform in Ogbomosoland, Nigeria. Residents photograph a single household item and you tell them which of exactly 4 bins it belongs in — or say plainly that you're not sure.

The 4 bins are:
- organic: food scraps, peels, garden waste — compostable
- plastic: bottles, sachets, plastic containers — rinsed and dry
- paper: cardboard, newspaper, clean packaging
- metal: cans, tins, scrap metal, glass bottles

CRITICAL RULE — read this twice:
A wrong confident answer is worse than an honest "not sure." People may act on this guidance in the real world. You MUST set "confident": false whenever ANY of these apply:
- The item is contaminated or mixed (e.g. a greasy pizza box — cardboard soiled with oil/food is not cleanly recyclable as paper, even though it looks like cardboard)
- The item doesn't belong in any of the 4 categories at all (batteries, electronics, styrofoam/polystyrene, textiles, medical waste, light bulbs, aerosol cans)
- The photo is blurry, too dark, too far away, or you cannot clearly identify what the item is
- The photo shows multiple different items and it's unclear which one to classify
- You have any genuine doubt about the correct category

When confident is false, set category to "uncertain" and use the guidance field to explain what the person should check manually or where to take the item instead (e.g. "batteries need a hazardous waste or e-waste drop-off point, not household bins").

When confident is true, still explain your reasoning briefly — people should understand why, not just get a label.

Respond ONLY with valid JSON in exactly this shape, nothing else, no markdown fences:
{"confident": true or false, "category": "organic" | "plastic" | "paper" | "metal" | "uncertain", "reasoning": "one short sentence", "guidance": "one short sentence of practical advice"}`;

module.exports = async function handler(req, res) {
  // CORS: allow the request from the browser (adjust origin in production
  // if you want to lock this down to your exact domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // This should only happen if the env var wasn't set in Vercel — fail
    // loudly in logs, but don't leak internals to the client.
    console.error('ANTHROPIC_API_KEY is not set in environment variables.');
    res.status(500).json({
      error: 'Server misconfiguration. The classifier is not available right now.',
    });
    return;
  }

  const { imageDataUrl } = req.body || {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    res.status(400).json({ error: 'Missing or invalid imageDataUrl. Expected a base64 data URL.' });
    return;
  }

  // Parse "data:image/jpeg;base64,XXXX" into media type + raw base64
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Could not parse image data URL.' });
    return;
  }
  const [, mediaType, base64Data] = match;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: 'Classify this item. Respond only with the JSON object described in your instructions.' },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      res.status(502).json({ error: 'The classifier service is temporarily unavailable. Please try again.' });
      return;
    }

    const data = await response.json();
    const rawText = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    let parsed;
    try {
      // Strip accidental markdown fences just in case, then parse
      const cleaned = rawText.replace(/^```json\s*|```$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse model response as JSON:', rawText);
      // SAFE FALLBACK: if we can't even parse the response, we do NOT
      // guess a category. We surface an honest "uncertain" result.
      res.status(200).json({
        confident: false,
        category: 'uncertain',
        reasoning: 'The classifier had trouble analyzing this photo.',
        guidance: 'Try a clearer, well-lit photo of a single item, or sort this one manually using the 4-bin guide above.',
      });
      return;
    }

    // Validate the shape defensively — never trust the model blindly.
    // If anything is malformed or the category isn't one of the 4 known
    // values, force it to the safe "uncertain" state rather than passing
    // through something that could render incorrectly on the frontend.
    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'uncertain';
    const confident = category !== 'uncertain' && parsed.confident === true;

    res.status(200).json({
      confident,
      category: confident ? category : 'uncertain',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      guidance: typeof parsed.guidance === 'string' ? parsed.guidance : 'When in doubt, sort this manually using the 4-bin guide above.',
    });
  } catch (err) {
    console.error('Unexpected error calling Anthropic API:', err);
    res.status(500).json({ error: 'Something went wrong reaching the classifier. Please try again.' });
  }
};