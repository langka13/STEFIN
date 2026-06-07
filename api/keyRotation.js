// ─── API Key Rotation ────────────────────────────────────────────────────────
// Kumpulkan semua key yang tersedia dari environment variables.
// Support GEMINI_API_KEY (lama) + GEMINI_API_KEY_1 s/d GEMINI_API_KEY_5

export function getApiKeys() {
  const keys = [];

  // Key lama (backward compatible)
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);

  // Key baru dengan nomor
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && !keys.includes(k)) keys.push(k);
  }

  return keys;
}

// Rotasi: coba tiap key sampai berhasil.
// Kalau semua 429 → lempar error yang jelas.
export async function fetchWithKeyRotation(buildRequest) {
  const keys = getApiKeys();

  if (keys.length === 0) {
    throw new Error('Tidak ada API key yang dikonfigurasi.');
  }

  let lastError = null;
  let allQuotaFull = true;

  for (const key of keys) {
    try {
      const { url, payload } = buildRequest(key);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resText = await response.text();
      let data;
      try {
        data = JSON.parse(resText);
      } catch {
        data = { error: { message: resText } };
      }

      if (response.status === 429) {
        // Key ini penuh, coba key berikutnya
        lastError = new Error('QUOTA_FULL');
        continue;
      }

      if (!response.ok) {
        allQuotaFull = false;
        lastError = new Error(data.error?.message || `HTTP ${response.status}`);
        // Error bukan quota → tidak perlu coba key lain
        throw lastError;
      }

      // Berhasil
      return { data, keyUsed: key };

    } catch (err) {
      if (err.message === 'QUOTA_FULL') {
        lastError = err;
        continue;
      }
      // Error lain (network, parse, dll) → langsung lempar
      throw err;
    }
  }

  // Semua key habis quota
  if (allQuotaFull || lastError?.message === 'QUOTA_FULL') {
    throw new Error(
      `Semua ${keys.length} API key sedang penuh kuota. Coba lagi dalam 1 menit.`
    );
  }

  throw lastError || new Error('Semua API key gagal.');
}
