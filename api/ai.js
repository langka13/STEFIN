export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, context, type } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'API Key missing.' });

  try {
    const sys = `SteFin AI Expert. Jawab singkat, detail, expert. Gunakan angka & data. No fluff.`;
    const userPrompt = `Data: ${JSON.stringify(context)}\nTanya: ${prompt}`;

    // Menggunakan gemini-flash-latest yang terkonfirmasi tersedia di list Anda
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: sys + "\n" + userPrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'Kuota penuh. Tunggu 30-60 detik ya.' });
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
