const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const MODEL = 'claude-sonnet-5';

const VALID_CATEGORIES = [
  'organic',
  'plastic',
  'paper',
  'metal'
];

const SYSTEM_PROMPT = `
You are a waste-sorting assistant for Ogbomó, a civic platform in Ogbomosoland, Nigeria.

Residents photograph a single household item and you tell them which of exactly 4 bins it belongs in — or say plainly that you're not sure.

The 4 bins are:

- organic: food scraps, peels, garden waste — compostable
- plastic: bottles, sachets, plastic containers — rinsed and dry
- paper: cardboard, newspaper, clean packaging
- metal: cans, tins, scrap metal, glass bottles

A wrong confident answer is worse than an honest "not sure."

Set confident to false whenever:

- The item is contaminated or mixed.
- The item doesn't belong in any of the 4 categories.
- The photo is blurry, too dark, too far away, or unclear.
- The photo shows multiple different items and it is unclear which one to classify.
- You have genuine doubt about the correct category.

When confident is false, set category to "uncertain".

Respond ONLY with valid JSON in exactly this shape:

{
  "confident": true or false,
  "category": "organic" | "plastic" | "paper" | "metal" | "uncertain",
  "reasoning": "one short sentence",
  "guidance": "one short sentence of practical advice"
}
`;

module.exports = async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not configured.');

    res.status(500).json({
      error: 'Server misconfiguration.'
    });

    return;
  }

  const { imageDataUrl } = req.body || {};

  if (
    !imageDataUrl ||
    typeof imageDataUrl !== 'string' ||
    !imageDataUrl.startsWith('data:image/')
  ) {
    res.status(400).json({
      error: 'Missing or invalid imageDataUrl.'
    });

    return;
  }

  // Extract media type and base64 image
  const match = imageDataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    res.status(400).json({
      error: 'Could not parse image data URL.'
    });

    return;
  }

  const [, mediaType, base64Data] = match;

  try {

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },

      body: JSON.stringify({
        model: MODEL,

        max_tokens: 300,

        system: SYSTEM_PROMPT,

        messages: [
          {
            role: 'user',

            content: [
              {
                type: 'image',

                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },

              {
                type: 'text',
                text: 'Classify this item. Respond only with the JSON object described in your instructions.'
              }
            ]
          }
        ]
      })
    });

    // IMPORTANT:
    // Read the response body ONCE.
    const responseText = await response.text();

    if (!response.ok) {

      console.error(
        'Anthropic API error:',
        response.status,
        responseText
      );

      res.status(502).json({
        error: 'Anthropic API request failed.',
        status: response.status,
        details: responseText
      });

      return;
    }

    // Parse the already-read response
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (parseError) {

      console.error(
        'Invalid JSON returned by Anthropic:',
        responseText
      );

      res.status(502).json({
        error: 'Invalid response from classifier service.'
      });

      return;
    }

    const rawText = (data.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    let parsed;

    try {

      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      parsed = JSON.parse(cleaned);

    } catch (parseError) {

      console.error(
        'Failed to parse model response:',
        rawText
      );

      res.status(200).json({
        confident: false,
        category: 'uncertain',
        reasoning: 'The classifier had trouble analyzing this photo.',
        guidance: 'Try a clearer, well-lit photo of a single item.'
      });

      return;
    }

    // Validate category
    const category = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'uncertain';

    const confident =
      category !== 'uncertain' &&
      parsed.confident === true;

    res.status(200).json({
      confident,

      category: confident
        ? category
        : 'uncertain',

      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : '',

      guidance:
        typeof parsed.guidance === 'string'
          ? parsed.guidance
          : 'When in doubt, sort this manually using the waste guide.'
    });

  } catch (err) {

    console.error(
      'FULL CLASSIFIER ERROR:',
      err
    );

    res.status(500).json({
      error: 'Classifier failed.',
      message:
        err instanceof Error
          ? err.message
          : String(err)
    });
  }
};
