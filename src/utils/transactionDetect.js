/**
 * Deteksi tipe & kategori transaksi dari teks Indonesia.
 * Dipakai parser lokal + koreksi hasil AI.
 */

const INVESTMENT_WORDS =
  /\b(reksadana|reksa\s*dana|\brd\b|saham|stock|ipo|obligasi|bond|emas|gold|logam\s*mulia|kripto|crypto|bitcoin|btc|ethereum|eth|deposito|tabungan\s*deposito|investasi|inves\b|etf|reksa|mutual\s*fund)\b/i;

export const PHYSICAL_ASSET_WORDS =
  /\b(properti|rumah|tanah|rumah\s*second|motor|mobil|kendaraan|aset\s*fisik)\b/i;

const PIUTANG_WORDS = /\b(piutang|pinjam\s+ke|pinjaman\s+ke|kasbon|ngutangin)\b/i;
const DEBT_WORDS = /\b(utang|hutang|pinjam\s+dari|terima\s+pinjaman|ngutang\s+dari)\b/i;
const TRANSFER_WORDS = /\b(transfer|kirim\s+ke|pindah\s+rekening|top.?up|topup|pindah\s+ke)\b/i;
const INCOME_WORDS = /\b(gaji|gajian|terima\s+gaji|bonus|thr|dividen|uang\s+masuk|pemasukan)\b/i;
const CONSUMPTION_BELI =
  /\b(beli|bayar|makan|pesan|byr|checkout|ongkir|belanja)\b/i;

const INITIAL_BEFORE =
  /\b(sebelum\s+stefin|sebelum\s+pake|sebelum\s+pakai|sudah\s+ada|dari\s+dulu|saldo\s+awal|existing|sejak\s+dulu)\b/i;
export const INITIAL_NOW =
  /\b(baru\s+sekarang|baru\s+beli|baru\s+bayar|hari\s+ini|sekarang|baru\s+terjadi)\b/i;

/** Deteksi tipe — prioritas: piutang/utang/aset sebelum pengeluaran generik "beli" */
export function detectTransactionType(lower) {
  const t = (lower || '').toLowerCase();

  if (PIUTANG_WORDS.test(t)) return 'transfer';
  if (DEBT_WORDS.test(t)) return 'debt';
  if (isAssetTransaction(t)) return 'asset';
  if (TRANSFER_WORDS.test(t) && !PIUTANG_WORDS.test(t)) return 'transfer';
  if (INCOME_WORDS.test(t)) return 'income';
  if (CONSUMPTION_BELI.test(t)) return 'expense';

  return 'expense';
}

function isAssetTransaction(lower) {
  const t = (lower || '').toLowerCase();
  if (INVESTMENT_WORDS.test(t) || PHYSICAL_ASSET_WORDS.test(t)) return true;
  if (/\b(beli|catat|tambah)\s+(emas|saham|reksadana|reksa|obligasi|kripto|crypto|rd|properti|rumah|motor|mobil|tanah)\b/i.test(t)) {
    return true;
  }
  if (/\b(aset|tabungan\s+khusus)\b/i.test(t)) return true;
  return false;
}

export function detectIsInitial(lower) {
  const t = (lower || '').toLowerCase();
  if (INITIAL_BEFORE.test(t)) return true;
  if (INITIAL_NOW.test(t)) return false;
  return undefined;
}

/** Kategori default sesuai taxonomy SteFin (5 Tipe → Kategori Baku) */
export function detectCategories(type, lower) {
  const t = (lower || '').toLowerCase();

  if (type === 'income') {
    if (/\b(dividen|deposito|sewa|pasif|bunga|royalti)\b/i.test(t)) {
      return { category: 'Pasif' };
    }
    return { category: 'Aktif' };
  }

  if (type === 'transfer') {
    if (PIUTANG_WORDS.test(t)) {
      return { category: 'Piutang Personal' };
    }
    return { category: 'Rekening Pribadi' };
  }

  if (type === 'debt') {
    if (/\b(bank|kpr|mortgage|kredit)\b/i.test(t)) {
      return { category: 'Perbankan' };
    }
    if (/\b(motor|mobil|kkb|kendaraan|leasing)\b/i.test(t)) {
      return { category: 'Leasing' };
    }
    return { category: 'Personal' };
  }

  if (type === 'asset') {
    if (/\b(reksadana|reksa\s*dana|\brd\b|saham|stock|ipo|obligasi|bond|kripto|crypto|bitcoin|btc|eth|emas|gold|logam|investasi|inves\b|etf)\b/i.test(t)) {
      return { category: 'Investasi' };
    }
    if (/\b(properti|rumah|tanah|motor|mobil|kendaraan)\b/i.test(t)) {
      return { category: 'Fisik' };
    }
    if (/\b(deposito|tabungan)\b/i.test(t)) {
      return { category: 'Kas' };
    }
    return { category: 'Investasi' };
  }

  // ── Expense: Keinginan (cek DULUAN karena paling spesifik) ──────────
  if (/\b(bioskop|nonton|film|konser|game|gaming|streaming|netflix|spotify|liburan|wisata|travel|hotel|resort|skincare|salon|spa|vape|rokok|fashion|branded|gucci|nike|adidas|gadget|iphone|samsung|belanja\s*online|shopee|tokped|lazada)\b/i.test(t)) {
    return { category: 'Keinginan' };
  }

  // ── Expense: Kewajiban (tagihan & cicilan rutin) ──────────────────
  if (/\b(cicilan|angsuran|pajak|asuransi|bpjs|zakat|infaq|fidyah|spp|ukt|kuliah|sekolah|les|kursus|tagihan|listrik\s*token|token\s*listrik|sewa|kos|kontrakan|kontrak|wifi|indihome|inet|iuran|rt\s*rw|arisan|nafkah|ortu|orang\s*tua|mama|papa|bapak|ibu|ayah|emak|bunda|abah|kredit|cicil|leasing)\b/i.test(t)) {
    return { category: 'Kewajiban' };
  }

  // ── Expense: Kebutuhan Pokok (makanan, transport, kesehatan, dll) ──
  if (/\b(makan|siang|malam|sarapan|nasi|warung|resto|restoran|kafe|cafe|kopi|teh|susu|jus|es|minum|beli|bayar|belanja|lauk|sayur|buah|beras|minyak|bumbu|garam|gula|telur|daging|ayam|ikan|tahu|tempe|bakso|mie|indomie|soto|sate|sop|gorengan|donat|roti|snack|jajan|cemilan|kantin|katering|catering|grab|gojek|ojol|ojek|taksi|taxi|angkot|bus|kereta|bensin|bbm|solar|parkir|tol|ongkos|ongkir|pulsa|paket\s*data|kuota|obat|dokter|apotek|rumah\s*sakit|rs|klinik|listrik|air|pdam|gas|lpg|galon|sabun|deterjen|sampo|odol|tissue|popok|pampers|internet)\b/i.test(t)) {
    return { category: 'Kebutuhan Pokok' };
  }

  // Default: Kebutuhan Pokok (lebih aman daripada Keinginan)
  return { category: 'Kebutuhan Pokok' };
}

/** Koreksi tipe AI yang salah (beli reksadana → expense) */
export function reconcileTypeWithText(draft, sourceText) {
  if (!sourceText) return draft;
  const lower = sourceText.toLowerCase();
  const detected = detectTransactionType(lower);

  const d = { ...draft };

  const shouldOverride =
    detected !== d.type &&
    (d.type === 'expense' || !d.type) &&
    ['asset', 'debt', 'transfer'].includes(detected);

  const piutang = PIUTANG_WORDS.test(lower);
  if (piutang) {
    d.type = 'transfer';
    Object.assign(d, detectCategories('transfer', lower));
    return d;
  }

  if (shouldOverride || (detected === 'asset' && d.type === 'expense')) {
    d.type = detected;
    const cats = detectCategories(detected, lower);
    Object.assign(d, cats);
  }

  if (d.isInitial === undefined) {
    const ini = detectIsInitial(lower);
    if (ini !== undefined) d.isInitial = ini;
  }

  return d;
}
