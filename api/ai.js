import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, context, type } = req.body;

  try {
    const sys = `SteFin Expert. Brief, technical, actionable. Use context numbers. No fluff.`;
    const userPrompt = `Context: ${JSON.stringify(context)}\nRequest: ${prompt}`;

    const isSuggestions = type === 'suggestions';

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: sys + '\n' + userPrompt,
      config: {
        temperature: isSuggestions ? 0.4 : 0.7,
        ...(isSuggestions
          ? {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            }
          : {}),
      },
    });

    const text = response.text || '';
    return res.status(200).json({ text });

  } catch (error) {
    console.error('AI Error:', error.message);

    if (error.message?.includes('kuota') || error.message?.includes('QUOTA_FULL')) {
      return res.status(429).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'AI Error' });
  }
}
