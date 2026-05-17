export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, context, type } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'API Key missing.' });

  try {
    const sys = `SteFin Expert. Brief, technical, actionable. Use context numbers. No fluff.`;
    const userPrompt = `Context: ${JSON.stringify(context)}\nRequest: ${prompt}`;

    // Menggunakan gemini-1.5-flash-8b (Paling ringan, kuota RPM paling longgar)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const payload = {
      contents: [{ role: "user", parts: [{ text: sys + "\n" + userPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 400 } // Sangat hemat token
    };

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = await response.json();

    // Fallback jika 8b tidak ditemukan
    if (!response.ok && response.status === 404) {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
      response = await fetch(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      data = await response.json();
    }

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'Kuota penuh (429). Mohon tunggu 1 menit.' });
      }
      throw new Error(data.error?.message || "AI Error");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (type === 'suggestions') text = text.replace(/```json|```/g, '').trim();

    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
