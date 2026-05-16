import { useState, useCallback } from 'react';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const askAI = useCallback(async ({ prompt, context, type = 'chat' }) => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, context, type }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch AI response');
      }

      const data = await response.json();
      return data.text;
    } catch (err) {
      setError(err.message);
      console.error('AI Hook Error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { askAI, loading, error };
}
