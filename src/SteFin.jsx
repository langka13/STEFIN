// ─── src/SteFin.jsx ──────────────────────────────────────────────────────────
// SteFin v1.2 — Firebase-integrated version
// Auth:     useAuth()        → Firebase Auth (email + Google)
// Database: useFirebase()    → Firestore real-time listeners
// Storage:  useFirebaseStorage() → onboarding flag persisted in Firestore

import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Menu, X, PlusCircle, Edit3, Trash2, User, Wallet,
  PieChart as IconPie, Activity, Settings, LayoutDashboard,
  Clock3, CreditCard, LogOut, Globe, CheckCircle,
  AlertTriangle, Sparkles, Loader2, Sun, Moon,
  Eye, EyeOff
} from 'lucide-react'

import { useAuth } from './hooks/useAuth'
import { useFirebase } from './hooks/useFirebase'
import { useFirebaseStorage } from './hooks/useFirebaseStorage'
import { useLanguage } from './contexts/LanguageContext.jsx'
import AssetsPage from './AssetsPage'
import AIAssistant from './AIAssistant'

// ─── Constants ───────────────────────────────────────────────────────────────
const TAXONOMY = {
  Kebutuhan: {
    'Pangan': ['Makan', 'Belanja Dapur (Groceries)', 'Air Minum'],
    'Tempat Tinggal': ['Biaya Sewa/Kontrak', 'Iuran Lingkungan'],
    'Utilitas Dasar': ['Listrik', 'Air (PDAM)'],
    'Kesehatan Dasar': ['Obat Rutin', 'BPJS Kesehatan'],
    'Transportasi Wajib': ['Bensin/Tol/Parkir', 'Transportasi Umum'],
    'Komunikasi': ['Paket Data & Pulsa'],
  },
  Kewajiban: {
    'Asuransi': ['Premi Jiwa', 'Kesehatan Swasta', 'Penyakit Kritis'],
    'Sosial & Agama': ['Orang Tua', 'Zakat', 'Persepuluhan', 'Infaq Rutin'],
    'Pajak': ['Pajak Kendaraan (STNK)', 'Pajak Bumi & Bangunan (PBB)'],
    'Pendidikan': ['SPP Sekolah/Kuliah', 'Kursus Rutin'],
    'Cicilan Utang': ['KPR', 'Kredit Kendaraan', 'Kartu Kredit'],
  },
  Keinginan: {
    'Hiburan': ['Langganan Digital', 'Tiket Bioskop'],
    'Gaya Hidup': ['Makan di Luar', 'Kopi/Camilan'],
    'Belanja': ['Pakaian (Fashion)', 'Aksesori', 'Gadget'],
    'Hobi & Liburan': ['Travelling', 'Alat Hobi', 'Self-reward'],
    'Perawatan Diri': ['Skincare', 'Salon/Barbershop'],
  },
}

const INCOME_CATEGORIES = {
  'Pemasukan Aktif': ['Gaji Pokok', 'Tunjangan', 'Lembur (Overtime)'],
  'Pemasukan Sampingan': ['Freelance / Project', 'Komisi / Affiliate', 'Hasil Penjualan Bisnis'],
  'Pemasukan Pasif': ['Dividen Saham', 'Bunga Deposito / Kupon Obligasi', 'Sewa Properti'],
  'Pemasukan Lain-lain': ['Bonus / THR', 'Hadiah / Give-away', 'Pengembalian Pajak'],
}

const ASSET_CATEGORIES = {
  'Kas & Likuid': ['Tabungan Bank', 'Dana Darurat', 'Kas Tunai'],
  'Investasi': ['Logam Mulia (Emas)', 'Saham', 'Reksadana', 'Obligasi', 'Aset Kripto'],
  'Aset Fisik': ['Properti (Tanah/Rumah)', 'Kendaraan'],
  Settlement: ['Pelunasan Piutang'],
}

const DEBT_CATEGORIES = {
  'Jangka Panjang': ['KPR (Mortgage)', 'Kredit Kendaraan (KKB)', 'Utang Modal Usaha'],
  'Jangka Pendek': ['Tagihan Kartu Kredit', 'Paylater', 'Pinjaman Personal'],
  Pelunasan: ['Bayar Utang'],
}

const TRANSFER_CATEGORIES = {
  'Internal Transfer': ['Antar Bank', 'Top-up E-Wallet', 'Tarik Tunai ATM'],
  'Piutang':           ['Pemberian Pinjaman', 'Pelunasan Piutang'],
}

const ACCOUNT_NAMES = {
  Bank: ['BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB Niaga', 'BSI', 'Permata', 'Danamon', 'BTN', 'Jenius', 'Lainnya'],
  Cash: ['Dompet', 'Kas Tunai', 'Celengan', 'Lainnya'],
  'E-Wallet': ['GoPay', 'OVO', 'DANA', 'ShopeePay', 'LinkAja', 'iSaku', 'Lainnya'],
}

const LEVELS = ['Kebutuhan', 'Kewajiban', 'Keinginan']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const PIE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#F472B6', '#EC4899']

const TODAY = new Date()
const CURRENT_MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const verifyNumber = (v) => Math.max(0, Number(v) || 0)
const formatIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0)
const getMonthKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
const monthLabel = (k) => { const [y, m] = k.split('-'); return `${MONTHS_FULL[Number(m) - 1]} ${y}` }

// ── Arus Kas (Debit/Kredit) ──────────────────────────────────────────────────
// Debit  = uang MASUK ke kas/saldo akun
// Kredit = uang KELUAR dari kas/saldo akun
// Transaksi dengan isInitial=true TIDAK mempengaruhi kas (sudah ada sebelum app)

const computeMonthlyStats = (txs) =>
  txs.reduce((acc, tx) => {
    const k = getMonthKey(tx.date)
    if (!acc[k]) acc[k] = { debit: 0, credit: 0, income: 0, expense: 0, piutangIn: 0, piutangOut: 0, assetOut: 0, debtIn: 0, debtOut: 0 }
    // ── DEBIT (uang masuk) ──
    if (tx.type === 'income') { acc[k].income += tx.amount; acc[k].debit += tx.amount }
    if (tx.type === 'asset' && tx.category === 'Settlement') { acc[k].piutangIn += tx.amount; acc[k].debit += tx.amount }
    if (tx.type === 'debt' && tx.category !== 'Pelunasan' && !tx.isInitial) { acc[k].debtIn += tx.amount; acc[k].debit += tx.amount }
    // ── KREDIT (uang keluar) ──
    if (tx.type === 'expense') { acc[k].expense += tx.amount; acc[k].credit += tx.amount }
    if (tx.type === 'transfer' && tx.category === 'Piutang' && !tx.isInitial) { acc[k].piutangOut += tx.amount; acc[k].credit += tx.amount }
    if (tx.type === 'asset' && tx.category !== 'Settlement' && !tx.isInitial) { acc[k].assetOut += tx.amount; acc[k].credit += tx.amount }
    if (tx.type === 'debt' && tx.category === 'Pelunasan') { acc[k].debtOut += tx.amount; acc[k].credit += tx.amount }
    return acc
  }, {})

const getCashIn = (s) => s.debit                              // Total debit (uang masuk)
const getCashOut = (s) => s.credit                             // Total kredit (uang keluar)
const getNetCashFlow = (s) => s.debit - s.credit               // Net = Debit - Kredit
const getSavings = (s) => s.income - s.expense                // Tabungan operasional

const getRollingBalance = (stats) => {
  let running = 0
  return Object.keys(stats).sort().map((month) => {
    const s = stats[month]
    const netFlow = getNetCashFlow(s)
    running += netFlow
    return { month, income: s.income, expense: s.expense, savings: getSavings(s), netFlow, running }
  })
}

const getAssistantMessages = (stats, totalBalance) => {
  const entries = Object.entries(stats).sort(([a], [b]) => a.localeCompare(b))
  const msgs = []
  if (totalBalance < 0)
    msgs.push({ type: 'danger', text: '⚠️ Saldo riil kamu negatif. Periksa kembali pengeluaran dan cadangan.' })
  if (entries.length >= 3) {
    const trends = entries.slice(-3).map(([, s]) => s.income - s.expense)
    if (trends[0] > trends[1] && trends[1] > trends[2])
      msgs.push({ type: 'warning', text: '📉 Surplus menurun 3 bulan berturut-turut. Kurangi pengeluaran konsumtif.' })
  }
  const cur = stats[CURRENT_MONTH]
  if (cur) {
    const ratio = cur.expense / (cur.income || 1)
    if (ratio > 0.9) msgs.push({ type: 'warning', text: `💡 Pengeluaran bulan ini mencapai ${Math.round(ratio * 100)}% dari pendapatan.` })
    else if (ratio < 0.5) msgs.push({ type: 'good', text: '✨ Bulan ini kamu menjaga stabilitas dengan baik. Pertahankan!' })
  }
  if (!msgs.length) msgs.push({ type: 'good', text: '✅ Kondisi keuangan kamu stabil. SteFin akan terus memantau.' })
  return msgs
}

const getMonthOptions = (count = 12) => {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1) + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` }
  })
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function SteFin() {
  const { lang, t, privacyMode, togglePrivacyMode } = useLanguage()

  // Auth
  const { user, authLoading, authError, setAuthError, registerWithEmail, loginWithEmail, loginWithGoogle, logout } = useAuth()
  const { askAI } = useAI();
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Firestore
  const {
    transactions, accounts, profile, dbLoading,
    saveProfile,
    addTransaction, updateTransaction, deleteTransaction,
    addAccount, updateAccount, deleteAccount,
  } = useFirebase(user?.uid)

  // Onboarding storage
  const { hasOnboarded, completeOnboarding } = useFirebaseStorage(saveProfile, profile)

  // Fetch AI Suggestions for Dashboard
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user || loadingSuggestions) return;
      setLoadingSuggestions(true);
      try {
        const res = await askAI({
          prompt: "Berikan saran otomatis singkat untuk dashboard saya.",
          context: {
            totalBalance,
            netWorth,
            currentStats,
            savingsRate
          },
          type: 'suggestions'
        });
        if (res) {
          const parsed = JSON.parse(res);
          setAiSuggestions(parsed.map(text => ({ text, type: 'info' })));
        }
      } catch (e) {
        console.error("AI Suggestion Error:", e);
        setAiSuggestions([{ text: "Gagal memuat saran AI. Coba segarkan halaman.", type: 'warning' }]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    if (page === 'dashboard') {
      fetchSuggestions();
    }
  }, [filterMonth, totalBalance, page]);

  // UI state
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [activeTx, setActiveTx] = useState(null)
  const [toast, setToast] = useState(null)

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])
  const [onboardStep, setOnboardStep] = useState(0)
  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH)
  const [txFilter, setTxFilter] = useState('all')

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(window.__stefin_toast)
    window.__stefin_toast = setTimeout(() => setToast(null), 3200)
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const monthlyStats = useMemo(() => computeMonthlyStats(transactions), [transactions])
  const rolling = useMemo(() => getRollingBalance(monthlyStats), [monthlyStats])

  const accountBalances = useMemo(() => {
    const txByAccount = {};
    transactions.forEach(tx => {
      if (!txByAccount[tx.accountId]) txByAccount[tx.accountId] = [];
      txByAccount[tx.accountId].push(tx);
      if (tx.targetAccountId) {
        if (!txByAccount[tx.targetAccountId]) txByAccount[tx.targetAccountId] = [];
        txByAccount[tx.targetAccountId].push(tx);
      }
    });

    return accounts.map(acc => {
      let currentBalance = acc.balance || 0;
      (txByAccount[acc.id] || []).forEach(tx => {
        if (tx.accountId === acc.id) {
          if (tx.type === 'income') currentBalance += tx.amount;
          if (tx.type === 'debt') {
            if (tx.category === 'Pelunasan') currentBalance -= tx.amount;
            else if (!tx.isInitial) currentBalance += tx.amount;
          }
          if (tx.type === 'expense') currentBalance -= tx.amount;
          if (tx.type === 'transfer') {
            if (tx.category === 'Piutang') {
              if (!tx.isInitial) currentBalance -= tx.amount;
            } else {
              currentBalance -= tx.amount;
            }
          }
          if (tx.type === 'asset') {
            if (tx.category === 'Settlement') currentBalance += tx.amount;
            else if (!tx.isInitial) currentBalance -= tx.amount;
          }
        }
        if (tx.targetAccountId === acc.id && tx.type === 'transfer') {
          currentBalance += tx.amount;
        }
      });
      return { ...acc, currentBalance };
    });
  }, [accounts, transactions])

  const totalBalance = useMemo(() => accountBalances.reduce((s, a) => s + (a.currentBalance || 0), 0), [accountBalances])

  const netWorth = useMemo(() => {
    const assets = transactions.filter(t => t.type === 'asset' && t.category !== 'Settlement').reduce((sum, t) => sum + t.amount, 0)
    const settlements = transactions.filter(t => t.type === 'asset' && t.category === 'Settlement').reduce((sum, t) => sum + t.amount, 0)
    const receivables = transactions.filter(t => t.type === 'transfer' && t.category === 'Piutang').reduce((sum, t) => sum + t.amount, 0)
    const debts = transactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan').reduce((sum, t) => sum + t.amount, 0)
    return totalBalance + assets + receivables - settlements - debts
  }, [transactions, totalBalance])

  const assistantMsgs = useMemo(() => getAssistantMessages(monthlyStats, totalBalance), [monthlyStats, totalBalance])
  const EMPTY_STATS = { debit: 0, credit: 0, income: 0, expense: 0, piutangIn: 0, piutangOut: 0, assetOut: 0, debtIn: 0, debtOut: 0 }
  const currentStats = monthlyStats[filterMonth] || EMPTY_STATS
  const currentSavings = getSavings(currentStats)
  const currentCashIn = getCashIn(currentStats)
  const currentCashOut = getCashOut(currentStats)
  const currentNetFlow = getNetCashFlow(currentStats)
  const savingsRate = currentStats.income ? Math.round((currentSavings / currentStats.income) * 100) : 0
  const monthOptions = getMonthOptions(12)

  const filteredTx = useMemo(() =>
    transactions
      .filter(tx => getMonthKey(tx.date) === filterMonth)
      .filter(tx => txFilter === 'all' || tx.type === txFilter)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions, filterMonth, txFilter]
  )

  const chartData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const s = monthlyStats[k] || EMPTY_STATS
      return { name: MONTHS[d.getMonth()], income: s.income, expense: s.expense, surplus: getSavings(s) }
    })
  }, [monthlyStats])

  const expensePieData = useMemo(() => {
    const totals = transactions
      .filter(tx => tx.type === 'expense' && getMonthKey(tx.date) === filterMonth)
      .reduce((acc, tx) => { acc[tx.level1 || 'Lainnya'] = (acc[tx.level1 || 'Lainnya'] || 0) + tx.amount; return acc }, {})
    return Object.entries(totals).map(([name, value]) => ({ name, value }))
  }, [transactions, filterMonth])



  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOnboardDone = async (userName) => {
    await completeOnboarding(userName || user?.name || 'Pengguna')
    setPage('dashboard')
    showToast('Onboarding selesai. Selamat datang di SteFin! 🎉')
  }

  const handleAddTransaction = async (tx) => {
    await addTransaction(tx)
    showToast('Transaksi berhasil ditambahkan.')
    setModal(null)
  }

  const handleUpdateTransaction = async (tx) => {
    await updateTransaction(tx)
    showToast('Transaksi diperbarui.')
    setModal(null)
    setActiveTx(null)
  }

  const handleDeleteTransaction = async (id) => {
    await deleteTransaction(id)
    showToast('Transaksi dihapus.')
  }

  const handleAddAccount = async (acc) => {
    await addAccount(acc)
    showToast('Akun sumber dana ditambahkan.')
    setModal(null)
  }

  const handleUpdateAccount = async (acc) => {
    await updateAccount(acc)
    showToast('Akun diperbarui.')
  }

  const handleDeleteAccount = async (id) => {
    await deleteAccount(id)
    showToast('Akun dihapus.')
  }

  const handleLogout = async () => {
    await logout()
    setPage('dashboard')
    setModal(null)
  }

  // ── Render guards ────────────────────────────────────────────────────────────
  // 1. Firebase auth still initialising
  if (authLoading) return <SplashScreen label={t('loading_stefin')} />

  // 2. Not logged in
  if (!user) return (
    <LoginScreen
      authError={authError}
      setAuthError={setAuthError}
      onEmail={async (name, email, password, isRegister) => {
        const res = isRegister
          ? await registerWithEmail(name, email, password)
          : await loginWithEmail(email, password)
        if (!res.success) showToast(res.error)
      }}
      onGoogle={async () => {
        const res = await loginWithGoogle()
        if (!res.success) showToast(res.error)
      }}
    />
  )

  // 3. Logged in but Firestore still loading
  if (dbLoading) return <SplashScreen label={t('loading_data')} />

  // 4. Logged in, not yet onboarded
  if (!hasOnboarded) return (
    <OnboardingScreen
      user={user}
      accounts={accountBalances}
      step={onboardStep}
      setStep={setOnboardStep}
      onAddAccount={handleAddAccount}
      onDone={handleOnboardDone}
    />
  )

  // 5. Main app
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition hover:border-emerald-400 dark:hover:border-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-400"
              onClick={() => setSidebarOpen(s => !s)}
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-2xl font-outfit font-semibold tracking-tight text-slate-900 dark:text-slate-50">SteFin</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('app_desc')}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="ml-auto grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-3">
            {/* Live sync indicator */}
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Firebase Sync
            </div>
            <button
              type="button"
              onClick={() => setModal('add-transaction')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-outfit font-semibold transition shadow-lg shadow-emerald-500/20"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">{t('add_tx')}</span>
              <span className="sm:hidden">+</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 transition hover:border-rose-500 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t('sign_out')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Sidebar overlay ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/60"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="text-lg font-outfit font-semibold text-slate-900 dark:text-slate-50">{t('main_menu') || 'Menu Utama'}</div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-rose-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {[
                  { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
                  { id: 'history', label: t('history'), icon: Clock3 },
                  { id: 'assets', label: t('assets'), icon: Wallet },
                  { id: 'accounts', label: t('accounts'), icon: CreditCard },
                  { id: 'profile', label: t('profile'), icon: User },
                  { id: 'settings', label: t('settings'), icon: Settings },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id} type="button"
                    onClick={() => { setPage(id); setSidebarOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${page === id
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${page === id ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    {label}
                  </button>
                ))}
                <div className="my-4 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => { setModal('add-transaction'); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-left text-sm font-semibold transition hover:opacity-90 shadow-sm"
                >
                  <PlusCircle className="h-5 w-5" />
                  {t('add_tx')}
                </button>
              </nav>

              {/* User card */}
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white text-lg font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{user.name}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {page === 'dashboard' && (
          <DashboardPage theme={theme}
            accounts={accountBalances}
            totalBalance={totalBalance}
            netWorth={netWorth}
            currentStats={currentStats}
            currentSavings={currentSavings}
            currentCashIn={currentCashIn}
            currentCashOut={currentCashOut}
            currentNetFlow={currentNetFlow}
            savingsRate={savingsRate}
            chartData={chartData}
            expensePieData={expensePieData}
            assistantMsgs={aiSuggestions}
            loadingSuggestions={loadingSuggestions}
            rolling={rolling}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            monthOptions={monthOptions}
          />
        )}
        {page === 'history' && (
          <HistoryPage
            filteredTx={filteredTx}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            txFilter={txFilter}
            setTxFilter={setTxFilter}
            monthOptions={monthOptions}
            accounts={accountBalances}
            onEdit={tx => { setActiveTx(tx); setModal('edit-transaction') }}
            onDelete={handleDeleteTransaction}
          />
        )}
        {page === 'accounts' && (
          <AccountsPage
            accounts={accountBalances}
            onAdd={() => setModal('add-account')}
            onUpdate={handleUpdateAccount}
            onDelete={handleDeleteAccount}
            onAdjust={acc => { setActiveTx(acc); setModal('adjust-account') }}
          />
        )}
        {page === 'assets' && (
          <AssetsPage
            transactions={transactions}
            accounts={accountBalances}
            totalBalance={totalBalance}
            netWorth={netWorth}
            onEdit={tx => { setActiveTx(tx); setModal('edit-transaction') }}
            onDelete={handleDeleteTransaction}
            onAdd={() => setModal('add-transaction')}
            onSaveTransaction={handleAddTransaction}
            onUpdateTransaction={async (id, fields) => {
              await updateTransaction({ id, ...fields })
              showToast('Piutang ditandai lunas.')
            }}
          />
        )}
        {page === 'profile' && (
          <ProfilePage user={user} accounts={accountBalances} transactions={transactions} netWorth={netWorth} />
        )}
        {page === 'settings' && <SettingsPage />}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'add-transaction' && (
          <TransactionModal
            accounts={accounts}
            onClose={() => setModal(null)}
            onSave={handleAddTransaction}
          />
        )}
        {modal === 'edit-transaction' && activeTx && (
          <TransactionModal
            tx={activeTx}
            accounts={accounts}
            onClose={() => { setModal(null); setActiveTx(null) }}
            onSave={handleUpdateTransaction}
          />
        )}
        {modal === 'add-account' && (
          <AccountModal
            onClose={() => setModal(null)}
            onSave={handleAddAccount}
          />
        )}
        {modal === 'adjust-account' && activeTx && (
          <AccountModal
            account={activeTx}
            onClose={() => { setModal(null); setActiveTx(null) }}
            onSave={handleUpdateAccount}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            className="fixed right-6 bottom-6 z-50 max-w-sm rounded-3xl border border-emerald-800/50 bg-white dark:bg-slate-900/50 backdrop-blur-md px-5 py-4 text-sm text-slate-900 dark:text-slate-50 shadow-sm dark:shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AIAssistant contextData={{
        totalBalance,
        netWorth,
        accounts: accountBalances.map(a => ({ name: a.name, balance: a.currentBalance, type: a.type })),
        recentTransactions: filteredTx.slice(0, 20).map(t => ({ date: t.date, category: t.level1, amount: t.amount, type: t.type, note: t.note })),
        monthlyStats: Object.entries(monthlyStats).map(([k, v]) => ({ month: k, income: v.income, expense: v.expense }))
      }} />
    </div>
  )
}

// ─── Splash / Loading ─────────────────────────────────────────────────────────
function SplashScreen({ label }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-900">
      <div className="flex flex-col items-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black text-4xl shadow-lg shadow-emerald-500/25">💼</div>
        <div className="text-2xl font-outfit font-semibold text-slate-900 dark:text-slate-50">SteFin</div>
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label || t('loading_stefin')}
        </div>
      </div>
    </div>
  )
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ authError, setAuthError, onEmail, onGoogle }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    await onEmail(name, email, password, isRegister)
    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    await onGoogle()
    setLoading(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-900 px-4 py-10 text-slate-900 dark:text-slate-50">
      {/* Background glow removed */}

      <div className="relative w-full max-w-md">
        <div className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 shadow-sm">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black text-3xl shadow-lg shadow-emerald-500/20">💼</div>
            <div className="text-3xl font-outfit font-semibold">SteFin</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('app_desc')}</p>
          </div>

          {/* Tab toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-white dark:bg-slate-900 p-1">
            {[t('login'), t('register')].map((label, i) => (
              <button
                key={label} type="button"
                onClick={() => { setIsRegister(i === 1); setAuthError(null) }}
                className={`rounded-xl py-2.5 text-sm font-medium transition ${(i === 1) === isRegister ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black text-slate-950' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {authError && (
            <div className="mb-4 rounded-2xl border border-rose-800/50 bg-rose-900/20 px-4 py-3 text-sm text-rose-400 font-outfit font-semibold">
              {authError}
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-3">
            {isRegister && (
              <input
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300 dark:text-zinc-600"
                placeholder={t('fullname')}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}
            <input
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300 dark:text-zinc-600"
              type="email" placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <input
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300 dark:text-zinc-600"
              type="password" placeholder={t('min_password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />

            <button
              type="button" onClick={handleSubmit} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black py-3 text-sm font-outfit font-semibold text-slate-950 transition hover:from-emerald-300 hover:to-teal-400 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRegister ? t('create_account') : t('login')}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-600 dark:text-slate-300 dark:text-zinc-600">{t('or')}</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button" onClick={handleGoogle} disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md py-3 text-sm text-slate-200 transition hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-60"
            >
              {/* Google SVG */}
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Lanjut dengan Google
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-300 dark:text-zinc-600">
            Data disimpan di Firebase Firestore — terenkripsi & real-time.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────
function OnboardingScreen({ user, accounts, step, setStep, onAddAccount, onDone }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  const [newAcc, setNewAcc] = useState({ name: '', type: 'Bank', balance: '', icon: '🏦' })
  const [saving, setSaving] = useState(false)
  const ICONS = { Bank: '🏦', Cash: '💵', 'E-Wallet': '💳' }

  const handleAdd = async () => {
    if (!newAcc.name || !newAcc.balance) return
    await onAddAccount({ name: newAcc.name, type: newAcc.type, balance: verifyNumber(newAcc.balance), icon: ICONS[newAcc.type] })
    setNewAcc({ name: '', type: 'Bank', balance: '', icon: '🏦' })
  }

  const handleDone = async () => {
    setSaving(true)
    await onDone(user.name)
    setSaving(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-900 px-4 py-10 text-slate-900 dark:text-slate-50">
      <div className="w-full max-w-4xl space-y-6 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-outfit font-semibold">{t('welcome_name')}, {user.name} 👋</div>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{t('onboard_welcome_desc')}</p>
          </div>
          {/* Step dots */}
          <div className="flex gap-2">
            {[0, 1].map(i => (
              <div key={i} className={`h-2 w-2 rounded-full transition ${i === step ? 'bg-emerald-400 w-6' : i < step ? 'bg-emerald-700' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left panel */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md p-6">
            <div className="mb-4 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('step_of', { step: step + 1, total: 2 })}</div>

            {step === 0 ? (
              <div className="space-y-4">
                <div className="text-xl font-outfit font-semibold">{t('basic_profile')}</div>
                <input className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" placeholder={t('fullname')} defaultValue={user.name} />
                <input className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-4 py-3 text-slate-500 dark:text-slate-400 outline-none" value={user.email} disabled />
                <button type="button" onClick={() => setStep(1)} className="rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black px-6 py-3 font-outfit font-semibold text-slate-950 transition hover:from-emerald-300 hover:to-teal-400">
                  {t('continue_btn')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xl font-outfit font-semibold">{t('register_accs')}</div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('register_accs_desc')}</p>

                {/* Existing accounts */}
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{acc.icon}</span>
                        <div>
                          <div className="text-sm font-outfit font-semibold">{acc.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{acc.type}</div>
                        </div>
                      </div>
                      <div className="text-sm font-outfit font-semibold text-emerald-400">{(privacyMode ? 'Rp •••••••' : formatIDR(acc.balance))}</div>
                    </div>
                  ))}
                </div>

                {/* Add account form */}
                <div className="rounded-2xl border border-dashed border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-2">
                  <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">+ {t('add_account')}</div>
                  {/* Tipe Akun */}
                  <select className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={newAcc.type} onChange={e => setNewAcc({ name: '', type: e.target.value, balance: newAcc.balance, icon: ICONS[e.target.value] })}>
                    <option value="Bank">{t('acc_type_bank')}</option>
                    <option value="Cash">{t('acc_type_cash')}</option>
                    <option value="E-Wallet">{t('acc_type_ewallet')}</option>
                  </select>
                  {/* Nama Akun — cascading */}
                  <select className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={newAcc.name} onChange={e => setNewAcc(p => ({ ...p, name: e.target.value }))}>
                    <option value="">— Pilih nama akun —</option>
                    {(ACCOUNT_NAMES[newAcc.type] || []).map(n => <option key={n} value={n} className="bg-white dark:bg-slate-900">{n}</option>)}
                  </select>
                  {/* Custom name jika Lainnya */}
                  {newAcc.name === 'Lainnya' && (
                    <input className="w-full rounded-xl border border-emerald-400 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" placeholder="Nama akun..." onChange={e => setNewAcc(p => ({ ...p, name: e.target.value }))} />
                  )}
                  {/* Saldo + Tambah */}
                  <div className="flex gap-2">
                    <input className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" type="number" placeholder={t('init_balance')} value={newAcc.balance} onChange={e => setNewAcc(p => ({ ...p, balance: e.target.value }))} />
                    <button type="button" onClick={handleAdd} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-50 hover:bg-slate-200 dark:hover:bg-slate-700">{t('add')}</button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(0)} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm text-slate-600 dark:text-slate-300 hover:border-emerald-500">{t('back_btn')}</button>
                  <button type="button" onClick={handleDone} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black px-5 py-3 text-sm font-outfit font-semibold text-slate-950 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-60">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('start_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — feature highlights */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md p-6">
            <div className="mb-6 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('main_features')}</div>
            <div className="space-y-4">
              {[
                { icon: <Sparkles className="h-4 w-4 text-emerald-400" />, title: 'Cashflow Awareness', desc: t('f1_desc') },
                { icon: <Activity className="h-4 w-4 text-emerald-400" />, title: 'Cumulative Sync', desc: t('f2_desc') },
                { icon: <AlertTriangle className="h-4 w-4 text-rose-400" />, title: 'Stability Assistant', desc: t('f3_desc') },
                { icon: <Globe className="h-4 w-4 text-blue-400" />, title: 'Firebase Realtime', desc: t('f4_desc') },
              ].map(f => (
                <div key={f.title} className="rounded-2xl bg-white dark:bg-slate-900/50 backdrop-blur-md p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-outfit font-semibold text-slate-900 dark:text-slate-50">
                    {f.icon}{f.title}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage({ theme, accounts, totalBalance, netWorth, currentStats, currentSavings, currentCashIn, currentCashOut, currentNetFlow, savingsRate, chartData, expensePieData, assistantMsgs, loadingSuggestions, rolling, filterMonth, setFilterMonth, monthOptions }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();

  const fmtIn = (v) => (v > 0 ? `+${(privacyMode ? 'Rp •••••••' : formatIDR(v))}` : (privacyMode ? 'Rp •••••••' : formatIDR(v)))
  const fmtOut = (v) => (v > 0 ? `-${(privacyMode ? 'Rp •••••••' : formatIDR(v))}` : (privacyMode ? 'Rp •••••••' : formatIDR(v)))

  return (
    <section className="space-y-6">
      {/* ── Hero: Kekayaan Bersih ── */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('net_worth')}
              <button type="button" onClick={togglePrivacyMode} className="text-slate-400 hover:text-emerald-500 transition-colors">
                {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className={`mt-2 text-4xl font-outfit font-semibold ${netWorth >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {(privacyMode ? 'Rp •••••••' : formatIDR(netWorth))}
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('cash_balance')}: {(privacyMode ? 'Rp •••••••' : formatIDR(totalBalance))}</div>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500"
              value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            >
              {monthOptions.map(m => <option key={m.key} value={m.key} className="bg-white dark:bg-slate-900">{m.label}</option>)}
            </select>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('stefin_ai_analyze'))}
              className="flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-sm font-outfit font-bold hover:opacity-90 transition"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="hidden sm:inline">Analisis AI</span>
            </button>
          </div>
        </div>

        {/* ── Laporan Operasional ── */}
        <div className="mt-6">
          <div className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">{t('operational_report')}</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('tx_income')}</div>
              <div className="mt-2 text-2xl font-outfit font-semibold text-emerald-500 dark:text-emerald-400">{(privacyMode ? 'Rp •••••••' : formatIDR(currentStats.income))}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('tx_expense')}</div>
              <div className="mt-2 text-2xl font-outfit font-semibold text-rose-500 dark:text-rose-400">{(privacyMode ? 'Rp •••••••' : formatIDR(currentStats.expense))}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('savings')}</div>
              <div className={`mt-2 text-2xl font-outfit font-semibold ${currentSavings >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                {(privacyMode ? 'Rp •••••••' : formatIDR(currentSavings))}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{savingsRate}% {t('from_income')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Arus Kas (Debit/Kredit) ── */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{t('cashflow')}</div>
        <div className="text-sm text-slate-400 dark:text-slate-500 mb-4">{t('cashflow_desc')}</div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* ─ Debit (Masuk) ─ */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t('debit')}</div>
            {[
              { label: t('tx_income'), value: currentStats.income },
              { label: t('asset_settlement'), value: currentStats.piutangIn },
              { label: t('debt_in_req'), value: currentStats.debtIn },

            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{r.label}</span>
                <span className="font-outfit font-semibold text-emerald-600 dark:text-emerald-400">{r.value > 0 ? fmtIn(r.value) : '—'}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between text-sm font-bold">
              <span className="text-slate-700 dark:text-slate-300">{t('total_debit')}</span>
              <span className="font-outfit text-emerald-600 dark:text-emerald-400">{fmtIn(currentCashIn)}</span>
            </div>
          </div>

          {/* ─ Kredit (Keluar) ─ */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">{t('credit')}</div>
            {[
              { label: t('tx_expense'), value: currentStats.expense },
              { label: t('receivable_given'), value: currentStats.piutangOut },
              { label: t('asset_bought'), value: currentStats.assetOut },
              { label: t('debt_settlement'), value: currentStats.debtOut },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{r.label}</span>
                <span className="font-outfit font-semibold text-rose-600 dark:text-rose-400">{r.value > 0 ? fmtOut(r.value) : '—'}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between text-sm font-bold">
              <span className="text-slate-700 dark:text-slate-300">{t('total_credit')}</span>
              <span className="font-outfit text-rose-600 dark:text-rose-400">{fmtOut(currentCashOut)}</span>
            </div>
          </div>
        </div>

        {/* ─ Net Cash Flow ─ */}
        <div className={`mt-4 rounded-2xl p-4 flex items-center justify-between ${currentNetFlow >= 0
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20'
          : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20'
          }`}>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('balance_change')}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('debit_minus_credit')}</div>
          </div>
          <div className={`text-2xl font-outfit font-bold ${currentNetFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {currentNetFlow >= 0 ? '+' : ''}{(privacyMode ? 'Rp •••••••' : formatIDR(currentNetFlow))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Area chart */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('cashflow_6m')}</div>
              <div className="mt-1 text-lg font-outfit font-semibold text-slate-900 dark:text-slate-50">Cashflow Awareness</div>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
              <CheckCircle className="h-3.5 w-3.5" /> {t('live_sync')}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} tickFormatter={v => `Rp${(v / 1e6).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: theme === 'dark' ? 'rgba(10,10,10,0.8)' : 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', borderRadius: 16, fontSize: 12, fontFamily: 'Inter', color: theme === 'dark' ? '#fff' : '#000' }} itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }} formatter={v => (privacyMode ? 'Rp •••••••' : formatIDR(v))} />
                <Area type="monotone" dataKey="income" stroke="#34d399" fill="url(#incG)" strokeWidth={3} name="Pendapatan" />
                <Area type="monotone" dataKey="expense" stroke="#fb7185" fill="url(#expG)" strokeWidth={3} name="Pengeluaran" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
          <div className="mb-4 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Alokasi Pengeluaran</div>
          <div className="text-lg font-outfit font-semibold text-slate-900 dark:text-slate-50 mb-4">Bulan Ini</div>
          {expensePieData.length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensePieData} dataKey="value" innerRadius={45} outerRadius={65} paddingAngle={4}>
                      {expensePieData.map((d, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#fff', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 12, fontSize: 12, color: theme === 'dark' ? '#fff' : '#000' }} formatter={v => (privacyMode ? 'Rp •••••••' : formatIDR(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {expensePieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-500 dark:text-slate-400">{d.name}</span>
                    </div>
                    <span className="font-medium text-slate-200">{(privacyMode ? 'Rp •••••••' : formatIDR(d.value))}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada pengeluaran bulan ini.</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Cumulative sync */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
          <div className="mb-4 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Riwayat Arus Kas</div>
          <div className="space-y-3">
            {rolling.slice(-4).map(r => (
              <div key={r.month} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 p-3">
                <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>{monthLabel(r.month)}</span>
                  <span className={`font-outfit font-semibold ${r.netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.netFlow >= 0 ? '+' : ''}{(privacyMode ? 'Rp •••••••' : formatIDR(r.netFlow))}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Akumulasi</span>
                  <span className={`font-outfit font-semibold ${r.running >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-rose-400'}`}>{(privacyMode ? 'Rp •••••••' : formatIDR(r.running))}</span>
                </div>
              </div>
            ))}
            {rolling.length === 0 && <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada data transaksi.</div>}
          </div>
        </div>

        {/* Accounts */}
        <div className="xl:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
          <div className="mb-4 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Akun Sumber Dana</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map(acc => (
              <div key={acc.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{acc.icon}</span>
                  <div>
                    <div className="text-sm font-outfit font-semibold">{acc.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{acc.type}</div>
                  </div>
                </div>
                <div className={`text-xl font-outfit font-semibold ${acc.currentBalance >= 0 ? 'text-emerald-400' : 'text-rose-400 font-outfit font-semibold'}`}>{(privacyMode ? 'Rp •••••••' : formatIDR(acc.currentBalance))}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white dark:bg-slate-900/50 backdrop-blur-md">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.max(8, (acc.currentBalance / Math.max(1, totalBalance)) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assistant */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Financial Stability Assistant</div>
            <div className="mt-1 text-lg font-outfit font-semibold">Saran Otomatis</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-outfit font-semibold border ${savingsRate >= 20 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' :
                savingsRate >= 0 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' :
                  'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20'
              }`}>
              Rasio Tabungan {savingsRate}%
            </span>
            {loadingSuggestions ? <Loader2 className="h-5 w-5 animate-spin text-emerald-500" /> : <Sparkles className="h-5 w-5 text-emerald-400" />}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assistantMsgs.map((m, i) => (
            <div key={i} className={`rounded-2xl border p-4 text-sm font-medium ${m.type === 'danger' ? 'border-rose-100 dark:border-rose-500/20  bg-rose-50 dark:bg-rose-500/10  text-rose-600 dark:text-rose-400' :
                m.type === 'warning' ? 'border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  'border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>{m.text}</div>
          ))}
          {assistantMsgs.length === 0 && !loadingSuggestions && (
            <div className="col-span-full py-4 text-center text-slate-500 text-xs italic">Belum ada saran untuk data ini.</div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── History Page ─────────────────────────────────────────────────────────────
function HistoryPage({ filteredTx, filterMonth, setFilterMonth, txFilter, setTxFilter, monthOptions, accounts, onEdit, onDelete }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('history')}</div>
          <div className="mt-1 text-xl font-outfit font-semibold">{filteredTx.length} {t('tx_count')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-2.5 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500"
            value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          >
            {monthOptions.map(m => <option key={m.key} value={m.key} className="bg-white dark:bg-slate-900">{m.label}</option>)}
          </select>
          <div className="flex rounded-2xl bg-white dark:bg-slate-900 p-1">
            {[['all', t('tx_all')], ['income', t('tx_income')], ['expense', t('tx_expense')], ['transfer', t('tx_transfer')], ['asset', t('tx_asset')], ['debt', t('tx_debt')]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setTxFilter(v)}
                className={`rounded-xl px-3 py-2 text-xs transition ${txFilter === v ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black text-slate-950 font-outfit font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {filteredTx.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400">{t('no_tx_period')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {[t('date'), t('category'), t('desc'), t('account'), t('amount'), t('action')].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredTx.map(tx => (
                  <tr key={tx.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-4 text-slate-500 dark:text-slate-400 text-xs">{tx.date}</td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-50">{tx.sub || tx.category}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{tx.type === 'income' ? t('tx_income') : tx.type === 'expense' ? tx.level1 || t('tx_expense') : tx.type === 'transfer' ? tx.category === 'Piutang' ? t('receivables') : t('tx_transfer') : tx.type === 'debt' ? (tx.category === 'Pelunasan' ? t('debt_settlement') : t('tx_debt')) : tx.category === 'Settlement' ? t('asset_settlement') : t('tx_asset')}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300 text-sm">{tx.note || '—'}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {accMap[tx.accountId]?.name || tx.accountId}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-outfit font-semibold text-sm ${tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false)
                        ? 'text-emerald-400'
                        : (tx.type === 'transfer' && tx.category === 'Piutang' && tx.isInitial) || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial)
                          ? 'text-slate-400'
                          : 'text-rose-400'
                      }`}>
                      {tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false) ? '+' : '-'}{(privacyMode ? 'Rp •••••••' : formatIDR(tx.amount))}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => onEdit(tx)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-emerald-600 hover:text-emerald-400">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => onDelete(tx.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-rose-600 hover:text-rose-400 font-outfit font-semibold">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Accounts Page ────────────────────────────────────────────────────────────
function AccountsPage({ accounts, onAdd, onUpdate, onDelete, onAdjust }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('accounts')}</div>
          <div className="mt-1 text-xl font-outfit font-semibold">{accounts.length} {t('registered_accounts')}</div>
        </div>
        <button type="button" onClick={onAdd} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black px-5 py-3 text-sm font-outfit font-semibold text-slate-950 hover:from-emerald-300 hover:to-teal-400">
          <PlusCircle className="h-4 w-4" /> {t('add_acc')}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map(acc => (
          <div key={acc.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{acc.icon}</span>
                <div>
                  <div className="font-outfit font-semibold">{acc.name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{acc.type}</div>
                </div>
              </div>
              <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">{acc.type}</span>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('real_balance')}</div>
              <div className={`text-2xl font-outfit font-semibold ${acc.currentBalance >= 0 ? 'text-emerald-400' : 'text-rose-400 font-outfit font-semibold'}`}>
                {(privacyMode ? 'Rp •••••••' : formatIDR(acc.currentBalance))}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => onAdjust(acc)} className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-400 transition">
                {t('adjust')}
              </button>
              <button type="button" onClick={() => onDelete(acc.id)} className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 py-2.5 text-xs text-slate-500 dark:text-slate-400 hover:border-rose-600 hover:text-rose-400 font-outfit font-semibold transition">
                {t('delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage({ user, accounts, transactions, netWorth }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  const totalInitial = accounts.reduce((s, a) => s + (a.balance || 0), 0)
  const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
  const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
  const activeMonths = new Set(transactions.map(tx => getMonthKey(tx.date))).size

  return (
    <section className="space-y-6 max-w-2xl">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black/20 text-2xl font-bold text-emerald-400">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="text-xl font-outfit font-semibold">{user.name}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
            <div className="mt-1 rounded-lg bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-400 inline-block">Firebase Auth ✓</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: t('total_income'), value: totalIncome, color: 'emerald' },
          { label: t('total_expense'), value: totalExpense, color: 'rose' },
          { label: t('net_worth'), value: netWorth, color: netWorth >= 0 ? 'emerald' : 'rose' },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
            <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{item.label}</div>
            <div className={`mt-2 text-2xl font-outfit font-semibold ${item.color === 'emerald' ? 'text-emerald-400' : item.color === 'rose' ? 'text-rose-400 font-outfit font-semibold' : 'text-slate-900 dark:text-slate-50'}`}>
              {(privacyMode ? 'Rp •••••••' : formatIDR(item.value))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 text-sm">
        <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t('stats')}</div>
        {[
          [t('total_tx'), transactions.length],
          [t('account_count'), accounts.length],
          [t('active_months'), activeMonths],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 last:border-0">
            <span className="text-slate-500 dark:text-slate-400">{l}</span>
            <span className="font-outfit font-semibold text-slate-900 dark:text-slate-50">{v}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage() {
  const { lang, changeLang, t, privacyMode, togglePrivacyMode } = useLanguage();

  return (
    <section className="max-w-xl space-y-4">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div className="text-xl font-outfit font-semibold mb-2">{t('settings')}</div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings_desc')}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-outfit font-semibold">{t('lang_pref')}</div>
          <Globe className="h-4 w-4 text-slate-400" />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => changeLang('id')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${lang === 'id' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
          >
            {t('lang_id')}
          </button>
          <button
            onClick={() => changeLang('en')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${lang === 'en' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
          >
            {t('lang_en')}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
        <div className="text-sm font-outfit font-semibold mb-3">{t('firebase_conn')}</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Project ID</span><span className="text-emerald-400 font-mono">stefin-apps</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Auth</span><span className="text-emerald-400">Email + Google ✓</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Database</span><span className="text-emerald-400">Firestore ✓</span></div>
          <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('offline_mode')}</span><span className="text-emerald-400">IndexedDB ✓</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
        <div className="text-sm font-outfit font-semibold mb-3">About & Credits</div>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          <p>
            <strong className="text-slate-900 dark:text-slate-50">SteFin (Smart Personal Finance)</strong><br />
            Versi 1.2.0 &copy; {new Date().getFullYear()}
          </p>
          <p>
            Dikembangkan dan dirancang oleh <strong className="text-emerald-500">Langka13</strong>.<br />
            Aplikasi ini dibuat untuk membantu mengelola arus kas pribadi secara cerdas, terstruktur, dan real-time.
          </p>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-1 text-xs uppercase tracking-widest text-slate-400">Tech Stack</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">React</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Vite</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Tailwind CSS v4</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Firebase</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Framer Motion</span>
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Recharts</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="mr-2">✉️</span> <a href="mailto:contact@langka13.com" className="text-emerald-500 hover:underline">contact@langka13.com</a>
          </div>
        </div>
      </div>
    </section>
  )
}


// ─── Transaction Modal ────────────────────────────────────────────────────────
function TransactionModal({ tx, accounts, onSave, onClose }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  const isEdit = Boolean(tx)
  const [type, setType] = useState(tx?.type || 'expense')
  const [level1, setLevel1] = useState(tx?.level1 || 'Kebutuhan')
  const [category, setCategory] = useState(tx?.category || '')
  const [sub, setSub] = useState(tx?.sub || '')
  const [accountId, setAccountId] = useState(tx?.accountId || accounts[0]?.id || '')
  const [targetAccountId, setTargetAccountId] = useState(tx?.targetAccountId || '')
  const [amount, setAmount] = useState(tx?.amount?.toString() || '')
  const [note, setNote] = useState(tx?.note || '')
  const [date, setDate] = useState(tx?.date || new Date().toISOString().split('T')[0])
  const [isInitial, setIsInitial] = useState(tx?.isInitial || false)
  const [saving, setSaving] = useState(false)

  const taxonomy = type === 'income' ? INCOME_CATEGORIES :
    type === 'asset' ? ASSET_CATEGORIES :
      type === 'debt' ? DEBT_CATEGORIES :
        type === 'transfer' ? TRANSFER_CATEGORIES :
          TAXONOMY[level1] || {}
  const categories = Object.keys(taxonomy)
  const subs = category ? taxonomy[category] || [] : []

  useEffect(() => {
    setCategory(Object.keys(taxonomy)[0] || '')
    setSub('')
  }, [type, level1])

  useEffect(() => { setSub(taxonomy[category]?.[0] || '') }, [category])

  const handleSave = async () => {
    if (!amount || !date || !accountId) return
    if (type === 'transfer' && category === 'Pindah Rekening' && !targetAccountId) return
    setSaving(true)
    const payload = {
      ...(isEdit ? { id: tx.id } : {}),
      type, category, sub, accountId,
      amount: verifyNumber(amount),
      note, date,
      ...(type === 'expense' ? { level1 } : {}),
      ...(type === 'asset' && category !== 'Settlement' ? { isInitial } : {}),
      ...(type === 'transfer' && category === 'Piutang' ? { isInitial } : {}),
      ...(type === 'debt' && category !== 'Pelunasan' ? { isInitial } : {}),
      ...(type === 'transfer' && category === 'Pindah Rekening' ? { targetAccountId } : {}),
    }
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto overscroll-contain rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900  shadow-sm dark:shadow-2xl p-6 shadow-sm dark:shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xl font-outfit font-semibold">{isEdit ? t('tx_edit_title') : t('tx_add_title')}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('smart_input')}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-emerald-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Type */}
          <div className="sm:col-span-2">
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('type')}</div>
            <div className="flex flex-wrap rounded-2xl bg-white dark:bg-slate-900 p-1 gap-1">
              {[['income', t('tx_income')], ['expense', t('tx_expense')], ['transfer', t('tx_transfer')], ['asset', t('tx_asset')], ['debt', t('tx_debt')]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => { setType(v); setIsInitial(false); }}
                  className={`flex-1 min-w-[80px] rounded-xl py-2.5 text-sm font-medium transition ${type === v ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black text-slate-950' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Asset / Piutang / Utang Source Selector (Sebelum / Sesudah) */}
          {((type === 'asset' && category !== 'Settlement') || (type === 'transfer' && category === 'Piutang') || (type === 'debt' && category !== 'Pelunasan')) && (
            <div className="sm:col-span-2 space-y-3">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{type === 'transfer' ? t('receivable_src') : type === 'debt' ? t('debt_src') : t('asset_src')}</div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setIsInitial(true)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${isInitial
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isInitial ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {isInitial && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-outfit font-semibold ${isInitial ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-50'}`}>{type === 'transfer' ? t('exist_receivable') : type === 'debt' ? t('exist_debt') : t('exist_asset')}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{type === 'transfer' ? t('exist_receivable_desc') : type === 'debt' ? t('exist_debt_desc') : t('exist_asset_desc')} {t('balance_unchanged')}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInitial(false)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${!isInitial
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${!isInitial ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {!isInitial && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-outfit font-semibold ${!isInitial ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-50'}`}>{type === 'transfer' ? t('new_receivable') : type === 'debt' ? t('new_debt') : t('new_asset')}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{type === 'transfer' ? t('new_receivable_desc') : type === 'debt' ? t('new_debt_desc') : t('new_asset_desc')}</div>
                  </div>
                </button>
              </div>
              {/* Balance Impact Preview */}
              {amount && verifyNumber(amount) > 0 && accountId && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ${isInitial
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : type === 'debt'
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  }`}>
                  {isInitial ? <CheckCircle className="h-4 w-4" /> : type === 'debt' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {isInitial
                    ? t('account_not_changed', { name: accounts.find(a => a.id === accountId)?.name || t('account').toLowerCase() })
                    : type === 'debt'
                      ? t('account_increased', { name: accounts.find(a => a.id === accountId)?.name || t('account').toLowerCase(), amount: (privacyMode ? 'Rp •••••••' : formatIDR(verifyNumber(amount))) })
                      : t('account_decreased', { name: accounts.find(a => a.id === accountId)?.name || t('account').toLowerCase(), amount: (privacyMode ? 'Rp •••••••' : formatIDR(verifyNumber(amount))) })
                  }
                </div>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('date')}</div>
            <input type="date" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Level 1 (expense only) */}
          {type === 'expense' && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('level_type')}</div>
              <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={level1} onChange={e => setLevel1(e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l} className="bg-white dark:bg-slate-900">{l}</option>)}
              </select>
            </div>
          )}

          {/* Category */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('category')}</div>
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-slate-900">{c}</option>)}
            </select>
          </div>

          {/* Sub-category */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('sub_category')}</div>
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={sub} onChange={e => setSub(e.target.value)}>
              {(subs.length ? subs : ['—']).map(s => <option key={s} value={s} className="bg-white dark:bg-slate-900">{s}</option>)}
            </select>
          </div>

          {/* Account */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{type === 'transfer' ? t('src_account') : t('account')}</div>
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id} className="bg-white dark:bg-slate-900">{a.name} ({a.type})</option>)}
            </select>
          </div>

          {/* Target Account (Transfer) */}
          {type === 'transfer' && category === 'Pindah Rekening' && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('target_account')}</div>
              <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}>
                <option value="">{t('select_target')}</option>
                {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id} className="bg-white dark:bg-slate-900">{a.name} ({a.type})</option>)}
              </select>
            </div>
          )}

          {/* Amount */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('amount_rp')}</div>
            <input type="number" min="0" placeholder="0" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={amount} onChange={e => setAmount(e.target.value)} />
            {amount && <div className="mt-1 text-xs text-emerald-400">{(privacyMode ? 'Rp •••••••' : formatIDR(verifyNumber(amount)))}</div>}
          </div>

          {/* Note */}
          <div className="sm:col-span-2">
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('optional_note')}</div>
            <input type="text" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300 dark:text-zinc-600" placeholder="e.g. Makan siang, Gaji bulan ini…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-3 text-sm text-slate-600 dark:text-slate-300 hover:border-rose-600 hover:text-rose-400 font-outfit font-semibold transition">{t('cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black px-6 py-3 text-sm font-outfit font-semibold text-slate-950 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? t('save') : t('add')} {t('tx_count')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Account Modal ────────────────────────────────────────────────────────────
function AccountModal({ account, onClose, onSave }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage();
  const isEdit = Boolean(account)
  const [type, setType] = useState(account?.type || 'Bank')
  const [nameChoice, setNameChoice] = useState(() => {
    if (!account?.name) return ''
    return ACCOUNT_NAMES[account.type || 'Bank']?.includes(account.name) ? account.name : 'Lainnya'
  })
  const [customName, setCustomName] = useState(() => {
    if (!account?.name) return ''
    return ACCOUNT_NAMES[account.type || 'Bank']?.includes(account.name) ? '' : account.name
  })
  const [balance, setBalance] = useState(account?.balance?.toString() || '')
  const [saving, setSaving] = useState(false)
  const ICONS = { Bank: '🏦', Cash: '💵', 'E-Wallet': '💳' }
  const nameOptions = ACCOUNT_NAMES[type] || []
  const resolvedName = nameChoice === 'Lainnya' ? customName : nameChoice

  const handleTypeChange = (newType) => {
    setType(newType)
    setNameChoice('')
    setCustomName('')
  }

  const handleSave = async () => {
    if (!resolvedName || balance === '') return
    setSaving(true)
    const payload = {
      ...(isEdit ? { id: account.id } : {}),
      name: resolvedName, type, balance: verifyNumber(balance), icon: ICONS[type]
    }
    await onSave(payload)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto overscroll-contain rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900  shadow-sm dark:shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xl font-outfit font-semibold">{isEdit ? t('acc_edit_title') : t('acc_add_title')}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('sync_desc')}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-emerald-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          {/* Step 1: Tipe Akun */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('acc_type') || 'Tipe Akun'}</div>
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={type} onChange={e => handleTypeChange(e.target.value)}>
              <option value="Bank">{t('acc_type_bank')}</option>
              <option value="Cash">{t('acc_type_cash')}</option>
              <option value="E-Wallet">{t('acc_type_ewallet')}</option>
            </select>
          </div>
          {/* Step 2: Nama Akun (cascading dari tipe) */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('acc_name_placeholder') || 'Nama Akun'}</div>
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={nameChoice} onChange={e => setNameChoice(e.target.value)}>
              <option value="">— Pilih nama akun —</option>
              {nameOptions.map(n => <option key={n} value={n} className="bg-white dark:bg-slate-900">{n}</option>)}
            </select>
          </div>
          {/* Step 3: Custom name jika pilih Lainnya */}
          {nameChoice === 'Lainnya' && (
            <input
              className="w-full rounded-2xl border border-emerald-400 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500 placeholder:text-slate-400"
              placeholder="Masukkan nama akun..."
              value={customName}
              onChange={e => setCustomName(e.target.value)}
            />
          )}
          {/* Saldo */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('init_balance')}</div>
            <input type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500 placeholder:text-slate-600" placeholder="0" value={balance} onChange={e => setBalance(e.target.value)} />
            {balance && <div className="mt-1 text-xs text-emerald-400">{(privacyMode ? 'Rp •••••••' : formatIDR(verifyNumber(balance)))}</div>}
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-3 text-sm text-slate-600 dark:text-slate-300 hover:border-rose-600 transition">{t('cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving || !resolvedName} className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 text-white dark:text-black px-6 py-3 text-sm font-outfit font-semibold text-slate-950 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('save_acc')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
