export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Key missing" });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const response = await fetch(url);
    const data = await response.json();
    
    return res.status(200).json({
      message: "Daftar model yang tersedia untuk API Key Anda:",
      models: data.models?.map(m => m.name) || [],
      raw: data
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
