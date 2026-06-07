import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { stats, totalBalance, netWorth } = req.body;

    const prompt = `Analisis data keuangan berikut dan berikan rekomendasi ringkas dalam Bahasa Indonesia.
Berikan insight terkait tren surplus/defisit, rasio tabungan, dan saran berdasarkan perilaku pengeluaran.

Data Saldo Total: Rp${totalBalance}
Kekayaan Bersih: Rp${netWorth}

Statistik Bulanan:
${JSON.stringify(stats, null, 2)}

Kamu adalah konsultan cerdas SteFin. Gunakan Markdown. Fokus pada analisis pola aliran kas. Singkat dan padat.`;

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
      contents: prompt,
      config: {
        temperature: 0.5,
      },
    });

    const analysis = response.text || '';
    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('AI Analysis Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
