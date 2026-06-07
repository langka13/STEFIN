import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    let { messages, dataContext } = req.body;

    const systemText = `You are SteFin's AI Personal Financial Consultant. You analyze financial data and provide helpful advice in Indonesian.

User's Financial Context:
${JSON.stringify(dataContext, null, 2)}

Provide clear, concise, and professional financial advice. Respond in Bahasa Indonesia. Keep it brief and friendly.`;

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemText,
        temperature: 0.7,
      },
    });

    let resultMsg = '';

    if (Array.isArray(messages) && messages.length > 0) {
      // Send the previous history sequentially, 
      // but in ai.chats.create we should ideally use history if we need it.
      // Instead we can just append historical messages to contents array.
      let promptText = messages.map(m => {
        let text = m.parts?.[0]?.text || m.content || '';
        return `${m.role === 'model' ? 'Assistant' : 'User'}: ${text}`;
      }).join('\n\n');

      resultMsg = promptText;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemText + '\n\n' + resultMsg,
      config: {
        temperature: 0.7,
      },
    });

    const text = response.text || '';
    return res.status(200).json({ text });
  } catch (error) {
    console.error('AI Chat Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
