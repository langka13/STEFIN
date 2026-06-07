import React, { createContext, useContext, useMemo, useState } from 'react';
import { getMonthKey, MONTHS, MONTHS_FULL, CURRENT_MONTH, isPiutangCategory } from '../utils/constants.js';

const FinancialContext = createContext({});

export const useFinancial = () => useContext(FinancialContext);

// ──────────────────────────────────────────────────────────────────────────────
// HELPER: Apakah transaksi ini adalah piutang?
// Piutang = type:'transfer' & category salah satu dari 'Piutang Personal'/'Piutang Usaha'
// ──────────────────────────────────────────────────────────────────────────────
const isTxPiutang = (tx) =>
  tx.type === 'transfer' && isPiutangCategory(tx.category)

const isTxSettlement = (tx) =>
  tx.type === 'asset' && tx.category === 'Settlement'

const isTxDebt = (tx) =>
  tx.type === 'debt' && tx.category !== 'Pelunasan'

const isTxDebtPayment = (tx) =>
  tx.type === 'debt' && tx.category === 'Pelunasan'

const isTxAsset = (tx) =>
  tx.type === 'asset' && tx.category !== 'Settlement'

// ──────────────────────────────────────────────────────────────────────────────
// ACCOUNT BALANCE COMPUTATION
//
// Saldo Rekening (Real Cash) = Saldo Awal + semua mutasi yang mempengaruhi kas
//
// MASUK (+):
//   - Pemasukan (income)
//   - Utang BARU (isInitial=false)  → dapat pinjaman = uang masuk
//   - Settlement piutang            → piutang dibayar kembali
//
// KELUAR (-):
//   - Pengeluaran (expense)
//   - Beli Aset BARU (isInitial=false)  → keluar uang beli aset
//   - Piutang BARU (isInitial=false)    → kasih pinjaman ke orang
//   - Bayar Utang (Pelunasan)           → keluar uang bayar utang
//
// TIDAK BERPENGARUH (isInitial=true):
//   - Aset yang sudah ada sebelum app
//   - Piutang yang sudah ada sebelum app
//   - Utang yang sudah ada sebelum app
// ──────────────────────────────────────────────────────────────────────────────
const computeAccountBalance = (acc, txByAccount) => {
  let balance = acc.balance || 0;
  const txList = txByAccount[acc.id] || [];

  for (const tx of txList) {
    if (tx.accountId === acc.id) {
      // Pemasukan → saldo naik
      if (tx.type === 'income') {
        balance += tx.amount;
      }
      // Pengeluaran → saldo turun
      else if (tx.type === 'expense') {
        balance -= tx.amount;
      }
      // Transfer rekening pribadi (bukan piutang) → saldo turun dari source
      else if (tx.type === 'transfer' && !isPiutangCategory(tx.category)) {
        balance -= tx.amount;
      }
      // Piutang BARU (kasih pinjaman) → saldo turun
      else if (isTxPiutang(tx) && !tx.isInitial) {
        balance -= tx.amount;
      }
      // Piutang initial → tidak berpengaruh ke saldo
      // else if (isTxPiutang(tx) && tx.isInitial) → skip

      // Aset BARU dibeli → saldo turun
      else if (isTxAsset(tx) && !tx.isInitial) {
        balance -= tx.amount;
      }
      // Aset initial → tidak berpengaruh ke saldo
      // else if (isTxAsset(tx) && tx.isInitial) → skip

      // Settlement piutang (piutang dibayar balik) → saldo naik
      else if (isTxSettlement(tx)) {
        balance += tx.amount;
      }

      // Utang BARU (isInitial=false) → dapat uang pinjaman → saldo naik
      else if (isTxDebt(tx) && !tx.isInitial) {
        balance += tx.amount;
      }
      // Utang initial → tidak berpengaruh ke saldo
      // else if (isTxDebt(tx) && tx.isInitial) → skip

      // Bayar utang → saldo turun
      else if (isTxDebtPayment(tx)) {
        balance -= tx.amount;
      }
    }

    // Transfer masuk ke target account
    if (tx.targetAccountId === acc.id && tx.type === 'transfer' && !isPiutangCategory(tx.category)) {
      balance += tx.amount;
    }
  }

  return balance;
};

// ──────────────────────────────────────────────────────────────────────────────
// MONTHLY STATS (untuk chart & arus kas per bulan)
// ──────────────────────────────────────────────────────────────────────────────
const computeMonthlyStats = (txs) =>
  txs.reduce((acc, tx) => {
    const k = getMonthKey(tx.date)
    if (!acc[k]) acc[k] = {
      debit: 0, credit: 0,
      income: 0, expense: 0,
      piutangIn: 0, piutangOut: 0,
      assetOut: 0, debtIn: 0, debtOut: 0
    }

    if (tx.type === 'income') {
      acc[k].income += tx.amount
      acc[k].debit += tx.amount
    }
    if (isTxSettlement(tx)) {
      acc[k].piutangIn += tx.amount
      acc[k].debit += tx.amount
    }
    if (isTxDebt(tx) && !tx.isInitial) {
      acc[k].debtIn += tx.amount
      acc[k].debit += tx.amount
    }
    if (tx.type === 'expense') {
      acc[k].expense += tx.amount
      acc[k].credit += tx.amount
    }
    if (isTxPiutang(tx) && !tx.isInitial) {
      acc[k].piutangOut += tx.amount
      acc[k].credit += tx.amount
    }
    if (isTxAsset(tx) && !tx.isInitial) {
      acc[k].assetOut += tx.amount
      acc[k].credit += tx.amount
    }
    if (isTxDebtPayment(tx)) {
      acc[k].debtOut += tx.amount
      acc[k].credit += tx.amount
    }
    return acc
  }, {})

const getCashIn = (s) => s.debit
const getCashOut = (s) => s.credit
const getNetCashFlow = (s) => s.debit - s.credit
const getSavings = (s) => s.assetOut

const getRollingBalance = (stats) => {
  let running = 0
  return Object.keys(stats).sort().map((month) => {
    const s = stats[month]
    const netFlow = getNetCashFlow(s)
    running += netFlow
    return { month, income: s.income, expense: s.expense, savings: getSavings(s), netFlow, running }
  })
}

const getMonthOptions = (count = 12) => {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1) + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` }
  })
}

const getAssistantMessages = (stats, sisaSaldo) => {
  const entries = Object.entries(stats).sort(([a], [b]) => a.localeCompare(b))
  const msgs = []
  if (sisaSaldo < 0)
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

const EMPTY_STATS = { debit: 0, credit: 0, income: 0, expense: 0, piutangIn: 0, piutangOut: 0, assetOut: 0, debtIn: 0, debtOut: 0 }

const computeStats = (txs) => {
  return txs.reduce((acc, tx) => {
    if (tx.type === 'income') { acc.income += tx.amount; acc.debit += tx.amount }
    if (isTxSettlement(tx)) { acc.piutangIn += tx.amount; acc.debit += tx.amount }
    if (isTxDebt(tx) && !tx.isInitial) { acc.debtIn += tx.amount; acc.debit += tx.amount }

    if (tx.type === 'expense') { acc.expense += tx.amount; acc.credit += tx.amount }
    if (isTxPiutang(tx) && !tx.isInitial) { acc.piutangOut += tx.amount; acc.credit += tx.amount }
    if (isTxAsset(tx) && !tx.isInitial) { acc.assetOut += tx.amount; acc.credit += tx.amount }
    if (isTxDebtPayment(tx)) { acc.debtOut += tx.amount; acc.credit += tx.amount }
    return acc
  }, { debit: 0, credit: 0, income: 0, expense: 0, piutangIn: 0, piutangOut: 0, assetOut: 0, debtIn: 0, debtOut: 0 })
}

// ──────────────────────────────────────────────────────────────────────────────
// NET WORTH COMPUTATION
//
// Nilai Kekayaan = (Saldo Awal + Aset [sebelum/sesudah] + Piutang Berjalan - Utang Berjalan)
//               + (Total Pemasukan - Total Pengeluaran)
//
// Komponen:
// - Saldo Awal = sum acc.balance dari semua akun (saldo initial saat setup)
// - Aset Total = semua aset fisik/kas/investasi (initial maupun baru)
// - Piutang Berjalan = total piutang - total yang sudah dilunasi
// - Utang Berjalan = total utang - total yang sudah dibayar
// - Total Pemasukan = semua income
// - Total Pengeluaran = semua expense
// ──────────────────────────────────────────────────────────────────────────────
const computeNetWorth = (transactions, accounts) => {
  // Saldo awal semua akun
  const initialBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0)

  let totalAset = 0        // Semua aset (fisik, kas, investasi) — initial & baru
  let totalSettlement = 0  // Pelunasan piutang diterima
  let totalPiutang = 0     // Semua piutang yang pernah dicatat
  let totalUtang = 0       // Semua utang yang pernah dicatat
  let totalPelunasanUtang = 0 // Pembayaran utang yang sudah dilakukan
  let totalIncome = 0
  let totalExpense = 0

  for (const tx of transactions) {
    if (isTxAsset(tx)) totalAset += tx.amount
    if (isTxSettlement(tx)) totalSettlement += tx.amount
    if (isTxPiutang(tx)) totalPiutang += tx.amount
    if (isTxDebt(tx)) totalUtang += tx.amount
    if (isTxDebtPayment(tx)) totalPelunasanUtang += tx.amount
    if (tx.type === 'income') totalIncome += tx.amount
    if (tx.type === 'expense') totalExpense += tx.amount
  }

  const piutangKeyMap = {}
  const piutangGroups = {}
  const utangKeyMap = {}
  const utangGroups = {}

  for (const tx of transactions) {
    if (isTxPiutang(tx)) {
      const key = (tx.note || tx.category || 'Lainnya').trim()
      piutangKeyMap[tx.id] = key
      if (!piutangGroups[key]) piutangGroups[key] = { nominal: 0, paid: 0 }
      piutangGroups[key].nominal += tx.amount
    }
    if (isTxDebt(tx)) {
      const key = (tx.note || tx.category || 'Lainnya').trim()
      utangKeyMap[tx.id] = key
      if (!utangGroups[key]) utangGroups[key] = { nominal: 0, paid: 0 }
      utangGroups[key].nominal += tx.amount
    }
  }

  for (const tx of transactions) {
    if (isTxSettlement(tx) && tx.settledPiutangId) {
      const key = piutangKeyMap[tx.settledPiutangId]
      if (key && piutangGroups[key]) piutangGroups[key].paid += tx.amount
    }
    if (isTxDebtPayment(tx) && tx.settledDebtId) {
      const key = utangKeyMap[tx.settledDebtId]
      if (key && utangGroups[key]) utangGroups[key].paid += tx.amount
    }
  }

  const piutangBerjalan = Object.values(piutangGroups).reduce((sum, g) => sum + Math.max(0, g.nominal - g.paid), 0)
  const utangBerjalan = Object.values(utangGroups).reduce((sum, g) => sum + Math.max(0, g.nominal - g.paid), 0)

  // Formula: (SaldoAwal + Aset + PiutangBerjalan - UtangBerjalan) + (Pemasukan - Pengeluaran)
  const netWorth = (initialBalance + totalAset + piutangBerjalan - utangBerjalan) + (totalIncome - totalExpense)

  return {
    netWorth,
    initialBalance,
    totalAset,
    totalSettlement,
    piutangBerjalan,
    utangBerjalan,
    totalIncome,
    totalExpense,
  }
}

export const FinancialProvider = ({ children, transactions = [], accounts = [], preferences = {}, addTransaction }) => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [dateRange, setDateRange] = useState({
    mode: 'monthly',
    start: startOfMonth,
    end: endOfMonth,
  });

  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH);
  const [txFilter, setTxFilter] = useState('all');

  const monthlyStats = useMemo(() => computeMonthlyStats(transactions), [transactions])
  const rolling = useMemo(() => getRollingBalance(monthlyStats), [monthlyStats])

  // ── Account Balances (Saldo Real Rekening) ────────────────────────────────
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

    return accounts.map(acc => ({
      ...acc,
      currentBalance: computeAccountBalance(acc, txByAccount),
    }));
  }, [accounts, transactions])

  // Sisa Saldo = total saldo real di semua rekening/akun
  const totalBalance = useMemo(() =>
    accountBalances.reduce((s, a) => s + (a.currentBalance || 0), 0),
    [accountBalances]
  )

  // ── Net Worth & Komponen ──────────────────────────────────────────────────
  const netWorthData = useMemo(() => computeNetWorth(transactions, accounts), [transactions, accounts])
  const netWorth = netWorthData.netWorth
  const totalAset = netWorthData.totalAset
  const piutangBerjalan = netWorthData.piutangBerjalan
  const utangBerjalan = netWorthData.utangBerjalan
  // Untuk backward compat
  const totalPiutang = piutangBerjalan
  const totalUtang = utangBerjalan

  const assistantMsgs = useMemo(() => getAssistantMessages(monthlyStats, totalBalance), [monthlyStats, totalBalance])

  const monthOptions = useMemo(() => getMonthOptions(12), [])

  const filteredTx = useMemo(() =>
    transactions
      .filter(tx => {
        const d = new Date(tx.date);
        return d >= dateRange.start && d <= dateRange.end;
      })
      .filter(tx => txFilter === 'all' || tx.type === txFilter)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [transactions, dateRange, txFilter]
  )

  const currentStats = useMemo(() => computeStats(filteredTx), [filteredTx])
  const currentSavings = getSavings(currentStats)
  const currentCashIn = getCashIn(currentStats)
  const currentCashOut = getCashOut(currentStats)
  const currentNetFlow = getNetCashFlow(currentStats)
  const savingsRate = currentStats.income ? Math.round((currentSavings / currentStats.income) * 100) : 0

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
    const totals = filteredTx
      .filter(tx => tx.type === 'expense')
      .reduce((acc, tx) => { acc[tx.category || 'Lainnya'] = (acc[tx.category || 'Lainnya'] || 0) + tx.amount; return acc }, {})
    return Object.entries(totals).map(([name, value]) => ({ name, value }))
  }, [filteredTx])

  const incomeByCategory = useMemo(() => {
    const totals = filteredTx
      .filter(tx => tx.type === 'income')
      .reduce((acc, tx) => {
        const cat = tx.category || 'Lainnya'
        acc[cat] = (acc[cat] || 0) + tx.amount;
        return acc
      }, {})
    return Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredTx])

  const expenseByCategory = useMemo(() => {
    return [...expensePieData].sort((a, b) => b.value - a.value)
  }, [expensePieData])

  const payload = useMemo(() => ({
    transactions,
    accounts: accountBalances,
    totalBalance,
    netWorth,

    // Net Worth components (untuk breakdown di Dashboard)
    netWorthData,
    totalAset,
    piutangBerjalan,
    utangBerjalan,
    totalPiutang,
    totalUtang,

    monthlyStats,
    rolling,
    assistantMsgs,

    currentStats,
    currentSavings,
    currentCashIn,
    currentCashOut,
    currentNetFlow,
    savingsRate,
    monthOptions,

    filterMonth,
    setFilterMonth,
    dateRange,
    setDateRange,
    txFilter,
    setTxFilter,
    filteredTx,

    chartData,
    expensePieData,
    incomeByCategory,
    expenseByCategory,
    addTransaction,
    preferences
  }), [
    transactions,
    accountBalances,
    totalBalance,
    netWorth,
    netWorthData,
    totalAset,
    piutangBerjalan,
    utangBerjalan,
    totalPiutang,
    totalUtang,
    monthlyStats,
    rolling,
    assistantMsgs,
    currentStats,
    currentSavings,
    currentCashIn,
    currentCashOut,
    currentNetFlow,
    savingsRate,
    monthOptions,
    filterMonth,
    dateRange,
    txFilter,
    filteredTx,
    chartData,
    expensePieData,
    incomeByCategory,
    expenseByCategory,
    addTransaction,
    preferences
  ]);

  return (
    <FinancialContext.Provider value={payload}>
      {children}
    </FinancialContext.Provider>
  )
}
