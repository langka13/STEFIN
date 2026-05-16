export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, context, type } = req.body;
  console.log(`[AI] Processing ${type} request...`);

  if (!process.env.GEMINI_API_KEY) {
    console.error('[AI] Error: GEMINI_API_KEY is missing');
    return res.status(500).json({ error: 'GEMINI_API_KEY belum terpasang di Vercel. Pastikan sudah tambah Env Variable dan melakukan RE-DEPLOY.' });
  }

  try {
    let systemInstruction = `
      Anda adalah SteFin AI, seorang konsultan keuangan pribadi profesional yang cerdas, ramah, dan solutif.
      Tugas Anda adalah membantu pengguna mengelola keuangan mereka berdasarkan data transaksi dan saldo mereka.
      Gunakan Bahasa Indonesia yang santai tapi profesional. Berikan saran yang praktis, konkret, dan mudah dipahami.
    `;

    if (type === 'analysis') {
      systemInstruction += `
        Fokus utama Anda saat ini adalah melakukan ANALISIS KEUANGAN mendalam.
        Identifikasi pola pengeluaran yang tidak sehat, hitung savings rate, dan berikan rekomendasi penghematan.
      `;
    }

    if (type === 'suggestions') {
      systemInstruction += `
        Tugas Anda adalah memberikan 3 SARAN SINGKAT (max 15 kata per saran) untuk dashboard keuangan.
        Saran harus spesifik berdasarkan data yang diberikan (misal: "Pengeluaran makan Anda tinggi, coba masak di rumah").
        PENTING: Kembalikan hanya dalam format JSON array STRING seperti ini: ["Saran 1", "Saran 2", "Saran 3"]. 
        Jangan berikan teks tambahan lain.
      `;
    }

    const fullPrompt = `
      Konteks Keuangan Pengguna:
      ${JSON.stringify(context, null, 2)}

      Pertanyaan/Permintaan Pengguna:
      ${prompt}

      Instruksi Tambahan:
      1. Gunakan emoji agar menarik.
      2. Selalu referensikan data angka dari konteks.
    `;

    // Menggunakan gemini-flash-latest yang terkonfirmasi stabil
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const payload = {
      contents: [{ role: "user", parts: [{ text: systemInstruction + "\n\n" + fullPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[AI] REST Error:", data);
      throw new Error(data.error?.message || "Gagal menghubungi Gemini API");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Bersihkan JSON jika AI menyertakan backticks
    if (type === 'suggestions') {
      text = text.replace(/```json|```/g, '').trim();
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('AI Error:', error);
    return res.status(500).json({ error: 'Gagal memproses permintaan AI: ' + error.message });
  }
}
