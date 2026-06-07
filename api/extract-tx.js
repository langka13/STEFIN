import { GoogleGenAI } from '@google/genai';
import {
  parseTransactionLocal,
  parseAccountsFromText,
  cleanUserText,
  matchAccountId,
} from '../src/utils/parseTransactionLocal.js';
import { reconcileTypeWithText } from '../src/utils/transactionDetect.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const SYSTEM_PROMPT = `Kamu parser transaksi keuangan SteFin (Indonesia). Ekstrak dari teks ATAU foto struk/resi/mutasi bank/e-wallet.
Return hanya SATU objek JSON saja (jangan return array), tanpa markdown. Jika ada banyak transaksi (seperti di mutasi), pilih 1 transaksi yang paling relevan / terakhir / terbesar yang difokuskan.

═══════════════════════════════════════════
TYPE (PENTING — jangan salah):
═══════════════════════════════════════════
- expense: pengeluaran konsumsi & kewajiban bayar (makan, ongkir, tagihan, SPP, iuran)
- income: gaji, bonus, uang masuk, hasil jual
- transfer: pindah rekening ATAU piutang (pinjam ke orang) → category "Piutang"
- asset: BELI/CATAT investasi & aset: reksadana, saham, emas, obligasi, kripto, properti, kendaraan — BUKAN expense
- debt: terima utang/pinjaman — BUKAN expense

═══════════════════════════════════════════
CATEGORY untuk expense — SANGAT PENTING:
═══════════════════════════════════════════
Pilih SALAH SATU dari 3 kategori ini:

1. "Kebutuhan Pokok" — pengeluaran WAJIB untuk kelangsungan hidup sehari-hari:
   ✅ Semua makanan & minuman (beli sate, makan siang, beli nasi, jajan, kopi, gorengan, mie ayam, bakso, dll)
   ✅ Belanja dapur & bahan masak (beras, sayur, bumbu, minyak goreng)
   ✅ Kebutuhan rumah tangga (sabun, deterjen, gas LPG, air galon)
   ✅ Transportasi harian (bensin, ongkos, parkir, tol, ojol, grab)
   ✅ Pulsa & paket data internet
   ✅ Kesehatan & obat-obatan

2. "Kewajiban" — pengeluaran yang WAJIB dibayar secara rutin/terjadwal:
   ✅ Tagihan listrik, air, wifi/internet rumah
   ✅ Sewa/kos/kontrakan
   ✅ SPP, UKT, biaya kuliah/sekolah
   ✅ Cicilan (motor, rumah, pinjaman)
   ✅ Iuran (BPJS, asuransi, RT, arisan wajib)
   ✅ Pajak (kendaraan, PBB)
   ✅ Nafkah/uang ke orang tua/keluarga yang RUTIN
   ✅ Zakat wajib, fidyah

3. "Keinginan" — pengeluaran yang TIDAK WAJIB, bisa ditunda/dihilangkan:
   ✅ Hiburan (nonton bioskop, game, streaming, konser)
   ✅ Belanja fashion & aksesoris (baju, sepatu, tas non-esensial)
   ✅ Liburan & wisata
   ✅ Gadget & elektronik non-esensial
   ✅ Rokok, vape
   ✅ Skincare mewah, salon
   ✅ Sedekah/sumbangan sukarela
   ✅ Arisan sukarela
   ✅ Jajan mewah (cafe mahal, restoran fine dining)

ATURAN KETAT:
- Jika ragu antara Kebutuhan Pokok vs Keinginan → pilih "Kebutuhan Pokok"
- Jika ragu antara Kewajiban vs Keinginan → pilih "Kewajiban"  
- Semua MAKANAN termasuk jajan, gorengan, kopi warung → "Kebutuhan Pokok"
- Bayar SPP/UKT/sekolah/kuliah → SELALU "Kewajiban"
- Kasih uang ke orang tua → "Kewajiban"
- Tagihan apapun (listrik, air, wifi, sewa) → SELALU "Kewajiban"

═══════════════════════════════════════════
CATEGORY untuk type lain:
═══════════════════════════════════════════
income: "Aktif" | "Pasif"
transfer: "Rekening Pribadi" | "Piutang Personal"
asset: "Fisik" | "Kas" | "Investasi" | "Settlement"
debt: "Perbankan" | "Personal" | "Leasing" | "Pelunasan"

═══════════════════════════════════════════
ACCOUNT ID (Sumber Dana):
═══════════════════════════════════════════
- Cocokkan nama dompet/bank dari teks/foto (misal "BCA", "Gopay", "OVO", "Mandiri", "Cash", "Tunai") dengan daftar akun yang diinfokan di input.
- Jika ada indikasi pembayaran dari aplikasi tertentu (misal logo QRIS, struk ShopeePay), pilih akun yang paling sesuai dari daftar.
- Jika tidak disebutkan atau tidak cocok satupun, set null.

═══════════════════════════════════════════
NOTE (Keterangan Transaksi):
═══════════════════════════════════════════
- Buat deskripsi yang rapi, padat, dan jelas (Kapitalisasi huruf awal kata).
- Struk/Resi toko: Tulis "Nama Toko: Ringkasan barang" (Contoh: "Indomaret: Beli Susu, Roti, dll", "SPBU: Beli Pertamax").
- Mutasi Bank/E-Wallet: Tulis nama pengirim/penerima dan berita transfer (Contoh: "Transfer ke Budi - Bayar Kos", "Topup OVO").
- Teks Bebas: Rapikan bahasanya agar enak dibaca (Contoh hasil: "Makan Siang Nasi Padang").

═══════════════════════════════════════════
FOTO/GAMBAR:
═══════════════════════════════════════════
Kamu HARUS bisa membaca:
- Struk belanja (Alfamart, Indomaret, warung) → ambil TOTAL, list item jadi NOTE.
- Mutasi bank / e-wallet → ambil 1 transaksi terdampak/terbaru. DR (Debit) = expense, CR (Kredit) = income.
- Resi pengiriman → ambil ongkir.
- Screenshot e-commerce → ambil total yang dibayar.

═══════════════════════════════════════════
FORMAT & OUTPUT HARAPAN:
═══════════════════════════════════════════
- AMOUNT: integer Rupiah (misal 25rb=25000, 1jt=1000000)
- accountId: id dari daftar akun (WAJIB cari match jika ada indikasi nama bank/dompet digital)
- date: selaraskan dengan bukti (format YYYY-MM-DD), gunakan hari ini jika tidak ada

{
  "type": "expense",
  "category": "Kebutuhan Pokok",
  "amount": 20000,
  "note": "Beli Sate Ayam",
  "date": "YYYY-MM-DD",
  "accountId": null,
  "isInitial": null,
  "confidence": "high"
}`;

function normalizeResult(parsed) {
  if (!parsed.type) parsed.type = 'expense';
  if (!parsed.date) parsed.date = new Date().toISOString().split('T')[0];
  if (parsed.amount != null && parsed.amount !== undefined) {
    parsed.amount = Number(parsed.amount) || 0;
  }
  if (parsed.isInitial === 'true') parsed.isInitial = true;
  if (parsed.isInitial === 'false') parsed.isInitial = false;
  if (parsed.isInitial === null || parsed.isInitial === 'null') delete parsed.isInitial;
  return parsed;
}

function parseGeminiJson(textResponse) {
  let clean = (textResponse || '{}')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) clean = jsonMatch[0];
  return JSON.parse(clean);
}

async function extractWithGemini(text, imageBase64) {
  const parts = [];

  if (imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp|gif|bmp);base64,/, '');
    const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType,
      },
    });
  }

  if (text) {
    parts.push({ text });
  }

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
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const textResponse = response.text || '{}';
  const parsed = parseGeminiJson(textResponse);

  if (parsed.error) {
    const err = new Error(parsed.error);
    err.statusCode = 422;
    throw err;
  }

  return normalizeResult(parsed);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, imageBase64 } = req.body || {};

  if (!text && !imageBase64) {
    return res.status(400).json({ error: 'Butuh text atau imageBase64' });
  }

  const accountsFromBody = parseAccountsFromText(text || '');
  const userText = cleanUserText(text || '');

  try {
    let result;

    try {
      result = await extractWithGemini(text, imageBase64);
    } catch (aiErr) {
      if (userText && !imageBase64) {
        const local = parseTransactionLocal(userText, accountsFromBody);
        if (local) result = local;
        else throw aiErr;
      } else {
        throw aiErr;
      }
    }

    if (!result.accountId && accountsFromBody.length && userText) {
      result.accountId = matchAccountId(userText.toLowerCase(), accountsFromBody);
    }

    if (userText) {
      result = reconcileTypeWithText(result, userText);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[extract-tx] error:', error.message);

    if (userText && !imageBase64) {
      const local = parseTransactionLocal(userText, accountsFromBody);
      if (local) return res.status(200).json(local);
    }

    if (error.statusCode === 422) {
      return res.status(422).json({ error: error.message });
    }

    if (
      error.message?.includes('kuota') ||
      error.message?.includes('QUOTA_FULL') ||
      error.message?.includes('penuh')
    ) {
      return res.status(429).json({ error: error.message });
    }

    return res.status(500).json({
      error: error.message || 'Gagal memproses transaksi.',
    });
  }
}
