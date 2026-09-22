const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const VALID_CATEGORIES = [
  'organic',
  'plastic',
  'paper',
  'metal'
];

const SYSTEM_PROMPT = `
You are a waste-sorting assistant for Ogbomó, a civic platform in Ogbomosoland, Nigeria.

Classify the single household item shown in the image into exactly one of these categories:

- organic: food scraps, peels, garden waste
- plastic: bottles, sachets, plastic containers
- paper: cardboard, newspaper, clean paper packaging
- metal: cans, tins, scrap metal

If the item is contaminated, unclear, blurry, mixed, or does not belong to these categories, return uncertain.

A wrong confident answer is worse than an honest uncertain answer.

Return ONLY valid JSON in exactly this format:

{
  "confident": true,
  "category": "organic",
  "reasoning": "Short explanation.",
  "guidance": "Short practical advice."
}

The category must be exactly one of:
organic, plastic, paper, metal, uncertain.

If uncertain, confident MUST be false and category MUST be "uncertain".
`;

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY is missing');

    return res.status(500).json({
      error: 'Gemini API key is not configured.'
    });
  }

  const { imageDataUrl } = req.body || {};

  if (
    !imageDataUrl ||
    typeof imageDataUrl !== 'string' ||
    !imageDataUrl.startsWith('data:image/')
  ) {
    return res.status(400).json({
      error: 'Missing or invalid imageDataUrl.'
    });
  }

  const match = imageDataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    return res.status(400).json({
      error: 'Could not parse image data URL.'
    });
  }

  const [, mediaType, base64Data] = match;

  try {

    const response = await fetch(
      `${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_PROMPT
              }
            ]
          },

          contents: [
            {
              role: 'user',

              parts: [
                {
                  inlineData: {
                    mimeType: mediaType,
                    data: base64Data
                  }
                },

                {
                  text: 'Classify this waste item. Return only the requested JSON.'
                }
              ]
            }
          ],

          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const responseText = await response.text();

    if (!response.ok) {

      console.error(
        'Gemini API error:',
        response.status,
        responseText
      );

      return res.status(502).json({
        error: 'Gemini API request failed.',
        status: response.status,
        details: responseText
      });
    }

    let data;

    try {
      data = JSON.parse(responseText);
    } catch (error) {

      console.error(
        'Could not parse Gemini response:',
        responseText
      );

      return res.status(502).json({
        error: 'Invalid response from Gemini.'
      });
    }

    const rawText =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

    if (!rawText) {

      console.error(
        'Gemini returned no text:',
        responseText
      );

      return res.status(502).json({
        error: 'Gemini returned an empty response.'
      });
    }

    let parsed;

    try {

      parsed = JSON.parse(rawText);

    } catch (error) {

      console.error(
        'Invalid JSON from Gemini:',
        rawText
      );

      return res.status(200).json({
        confident: false,
        category: 'uncertain',
        reasoning: 'The classifier could not reliably analyze this photo.',
        guidance: 'Try taking a clearer photo of a single item.'
      });
    }

    const category = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'uncertain';

    const confident =
      category !== 'uncertain' &&
      parsed.confident === true;

    return res.status(200).json({
      confident: confident,
      category: confident ? category : 'uncertain',
      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : '',
      guidance:
        typeof parsed.guidance === 'string'
          ? parsed.guidance
          : 'When in doubt, check the waste guide manually.'
    });

  } catch (error) {

    console.error(
      'FULL GEMINI CLASSIFIER ERROR:',
      error
    );

    return res.status(500).json({
      error: 'Classifier failed.',
      message:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
};
