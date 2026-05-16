import { GoogleGenerativeAI } from '@google/generative-ai';

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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let systemInstruction = `
      Anda adalah SteFin AI, seorang konsultan keuangan pribadi profesional yang cerdas, ramah, dan solutif.
      Tugas Anda adalah membantu pengguna mengelola keuangan mereka berdasarkan data transaksi dan saldo mereka.
      Gunakan Bahasa Indonesia yang santai tapi profesional. Berikan saran yang praktis, konkret, dan mudah dipahami.
    `;

    if (type === 'analysis') {
      systemInstruction += `
        Fokus utama Anda saat ini adalah melakukan ANALISIS KEUANGAN mendalam.
        Identifikasi pola pengeluaran yang tidak sehat, hitung savings rate, dan berikan rekomendasi penghematan.
        Jika ada surplus, sarankan alokasi investasi yang sesuai.
      `;
    }

    const fullPrompt = `
      Konteks Keuangan Pengguna:
      ${JSON.stringify(context, null, 2)}

      Pertanyaan/Permintaan Pengguna:
      ${prompt}

      Instruksi Tambahan:
      1. Berikan jawaban dalam format Markdown yang rapi.
      2. Gunakan emoji agar lebih menarik.
      3. Jangan memberikan saran investasi yang berisiko tinggi tanpa peringatan.
      4. Selalu referensikan data angka dari konteks yang diberikan.
    `;

    const result = await model.generateContent([systemInstruction, fullPrompt]);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error) {
    console.error('AI Error:', error);
    return res.status(500).json({ error: 'Gagal memproses permintaan AI: ' + error.message });
  }
}
