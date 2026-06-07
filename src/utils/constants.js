// Warnai Pie Chart
export const PIE_COLORS = [
  '#10b981', '#f43f5e', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
]

// Format IDR string
export const formatIDR = (num) => {
  if (!num && num !== 0) return '0'
  return num.toLocaleString('id-ID')
}

const CURRENCIES_MAP = {
  IDR: 'Rp',
  USD: '$',
  EUR: '€',
  SGD: 'S$',
  MYR: 'RM',
  JPY: '¥',
};

export const displayIDR = (num, privacyMode = false) => {
  const code = typeof window !== 'undefined' ? (localStorage.getItem('stefin_currency') || 'IDR') : 'IDR';
  const symbol = CURRENCIES_MAP[code] || 'Rp';
  if (privacyMode) return `${symbol} •••••••`
  return `${symbol} ${formatIDR(num)}`
}

export const verifyNumber = (val) => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const parsed = parseInt(val.toString().replace(/\D/g, ''), 10)
  return isNaN(parsed) ? 0 : parsed
}

// ── Bulan & Tanggal ─────────────────────────────────────────────────────────
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
export const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const TODAY = new Date()
export { TODAY }
export const CURRENT_MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`

export const getMonthKey = (d) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export const monthLabel = (monthOffset) => {
  if (typeof monthOffset === 'number') {
    if (monthOffset === 0) return 'Bulan Ini'
    const d = new Date()
    d.setMonth(d.getMonth() - monthOffset)
    return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }
  // If it's a key like "2026-05"
  const [y, m] = String(monthOffset).split('-')
  return `${MONTHS_FULL[Number(m) - 1]} ${y}`
}

// ── Nama Akun (untuk OnboardingScreen & AccountModal) ────────────────────────
export const ACCOUNT_NAMES = {
  Bank: ['BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB Niaga', 'BSI', 'Permata', 'Danamon', 'BTN', 'Jenius', 'Lainnya'],
  Cash: ['Dompet', 'Kas Tunai', 'Celengan', 'Lainnya'],
  'E-Wallet': ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'iSaku', 'Lainnya'],
}

// ── Legacy compat: LEVELS (untuk backward compat jika ada file lain yang masih import) ──
export const LEVELS = ['Kebutuhan Pokok', 'Kewajiban', 'Keinginan']

// ==========================================
// KATEGORI BAKU (Sesuai Spesifikasi User)
// ==========================================
export const INCOME_CATEGORIES = ['Aktif', 'Pasif']
export const EXPENSE_CATEGORIES = ['Kebutuhan Pokok', 'Kewajiban', 'Keinginan']
export const TRANSFER_CATEGORIES = ['Rekening Pribadi', 'Piutang Personal']
export const ASSET_CATEGORIES = ['Fisik', 'Kas', 'Investasi', 'Settlement'] // Settlement untuk internal balik piutang
export const DEBT_CATEGORIES = ['Perbankan', 'Personal', 'Leasing', 'Pelunasan'] // Pelunasan untuk internal bayar utang

// TAXONOMY map (untuk SteFin.jsx backward compat)
export const TAXONOMY = {
  income: INCOME_CATEGORIES,
  expense: EXPENSE_CATEGORIES,
  transfer: TRANSFER_CATEGORIES,
  asset: ASSET_CATEGORIES,
  debt: DEBT_CATEGORIES,
}

export const getCategoryOptions = (type, customCategories = {}) => {
  let base = [];
  switch (type) {
    case 'income': base = INCOME_CATEGORIES; break;
    case 'expense': base = EXPENSE_CATEGORIES; break;
    case 'transfer': base = TRANSFER_CATEGORIES; break;
    case 'asset': base = ASSET_CATEGORIES.filter(c => c !== 'Settlement'); break; // Settlement itu internal app
    case 'debt': base = DEBT_CATEGORIES.filter(c => c !== 'Pelunasan'); break; // Pelunasan itu internal app
    default: return [];
  }
  
  const custom = customCategories[type] || [];
  return [...base, ...custom];
}

// Helper Deteksi Piutang
export const isPiutangCategory = (category) => {
  return ['Piutang Personal', 'Piutang Usaha'].includes(category);
}
