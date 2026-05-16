export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, context, type } = req.body;
  console.log(`[AI] Processing ${type} request...`);

  if (!process.env.GEMINI_API_KEY) {
    console.error('[AI] Error: GEMINI_API_KEY is missing');
    return res.status(500).json({ error: 'GEMINI_API_KEY belum terpasang di Vercel.' });
  }

  try {
    let systemInstruction = `
      Anda adalah SteFin AI, pakar konsultan keuangan profesional.
      PRINSIP KOMUNIKASI:
      1. EXPERT & DETAIL: Gunakan logika keuangan (Emergency Fund, Savings Rate, 50/30/20, Debt-to-Income).
      2. EFEKTIF: Jangan bertele-tele. Langsung ke inti analisis dan saran.
      3. DATA-DRIVEN: Selalu kaitkan jawaban dengan angka riil dari konteks yang diberikan.
      4. NO FLUFF: Hindari kalimat pembuka/penutup yang klise jika tidak menambah nilai informasi.
    `;

    if (type === 'analysis') {
      systemInstruction += `
        Fokus: ANALISIS MENDALAM. Berikan poin-poin kritis tentang pola belanja, kebocoran dana, dan efisiensi tabungan.
      `;
    }

    if (type === 'suggestions') {
      systemInstruction += `
        Fokus: 3 SARAN SINGKAT & TAJAM (max 12 kata per saran). 
        Format: Hanya JSON array STRING. Contoh: ["Pangkas biaya makan 10% untuk dana darurat", ...]. No other text.
      `;
    }

    const fullPrompt = `
      Konteks Keuangan:
      ${JSON.stringify(context, null, 2)}

      Permintaan:
      ${prompt}
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{ role: "user", parts: [{ text: systemInstruction + "\n\n" + fullPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 } // Low temp for more precise/expert answers
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
       // Fallback to gemini-flash-latest if 2.0-flash fails
       const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
       const fbRes = await fetch(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
       const fbData = await fbRes.json();
       if (!fbRes.ok) throw new Error(fbData.error?.message || "AI API Error");
       return res.status(200).json({ text: fbData.candidates?.[0]?.content?.parts?.[0]?.text || "" });
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (type === 'suggestions') text = text.replace(/```json|```/g, '').trim();

    return res.status(200).json({ text });
  } catch (error) {
    console.error('AI Error:', error);
    return res.status(500).json({ error: 'Gagal memproses AI: ' + error.message });
  }
}
