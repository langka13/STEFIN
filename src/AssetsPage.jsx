import { useState, useMemo, memo } from 'react'
import { PlusCircle, Edit3, Trash2, CheckCircle, Zap, ChevronDown, ChevronUp, Package, TrendingUp, Wallet, CreditCard, Users, Building2, Car } from 'lucide-react'
import { useFinancial } from './contexts/FinancialContext.jsx'
import { useLanguage } from './contexts/LanguageContext.jsx'
import { displayIDR, formatIDR, isPiutangCategory } from './utils/constants.js'
import DataTable from './components/DataTable.jsx'

// ── Reusable Progress Bar ──
function ProgressBar({ paid, total, color = 'emerald' }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const colorMap = {
    emerald: { bar: 'bg-emerald-500', track: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
    rose: { bar: 'bg-rose-500', track: 'bg-rose-100 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
    amber: { bar: 'bg-amber-500', track: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
    blue: { bar: 'bg-blue-500', track: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
    violet: { bar: 'bg-violet-500', track: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-600 dark:text-violet-400' },
  }
  const c = colorMap[color] || colorMap.emerald
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 h-1.5 rounded-full ${c.track} overflow-hidden`}>
        <div className={`h-full rounded-full ${c.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-bold ${c.text} w-8 text-right`}>{pct}%</span>
    </div>
  )
}

// ── Status Badge ──
function StatusBadge({ status }) {
  if (status === 'paid') return (
    <span className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" /> Lunas
    </span>
  )
  if (status === 'partial') return (
    <span className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase border border-amber-100 dark:border-amber-500/20">
      Sebagian
    </span>
  )
  return (
    <span className="rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase border border-blue-100 dark:border-blue-500/20">
      Belum Lunas
    </span>
  )
}

// ── Summary Card ──
function SummaryCard({ label, value, sub, color = 'emerald', icon: Icon, privacyMode }) {
  const accentMap = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', val: 'text-emerald-600 dark:text-emerald-400' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-500/10', icon: 'text-rose-500 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-500/20', val: 'text-rose-600 dark:text-rose-400' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', icon: 'text-blue-500 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-500/20', val: 'text-blue-600 dark:text-blue-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', icon: 'text-amber-500 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-500/20', val: 'text-amber-600 dark:text-amber-400' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-500/10', icon: 'text-violet-500 dark:text-violet-400', iconBg: 'bg-violet-100 dark:bg-violet-500/20', val: 'text-violet-600 dark:text-violet-400' },
  }
  const c = accentMap[color] || accentMap.emerald

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${c.icon}`} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right leading-tight max-w-[70%]">{label}</p>
      </div>
      <p className={`text-base sm:text-lg font-bold tracking-tight ${c.val} tabular-nums truncate`}>
        {displayIDR(value, privacyMode)}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

function GroupedRow({ label, rows, totalNominal, totalPaid, type, onSettle, onPay, onEdit, onDelete, formatMoney, isExpanded, onToggle }) {
  const remaining = Math.max(0, totalNominal - totalPaid)
  const status = totalPaid >= totalNominal ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'
  const isPiutang = type === 'piutang'
  const isDebt = type === 'debt'

  return (
    <div className="border-b border-slate-100 dark:border-slate-800/80 last:border-0 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold shadow-sm
              ${isPiutang ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
              {label?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">{label || '—'}</div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{rows.length} Transaksi</div>
            </div>
          </div>
          <div className="shrink-0 ml-3">
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="flex items-end justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
              {status === 'paid' ? 'Lunas' : 'Sisa Tagihan'}
            </div>
            {status === 'partial' ? (
              <div className="flex flex-col gap-0.5">
                <span className={`font-bold text-lg leading-none ${isPiutang ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatMoney(remaining)}
                </span>
                <span className="text-[10px] text-slate-400 line-through">{formatMoney(totalNominal)}</span>
              </div>
            ) : status === 'paid' ? (
              <span className="font-bold text-lg leading-none text-slate-400 line-through">{formatMoney(totalNominal)}</span>
            ) : (
              <span className={`font-bold text-lg leading-none ${isPiutang ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatMoney(totalNominal)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status !== 'paid' && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); isPiutang ? onSettle(rows[0]) : onPay(rows[0]) }}
                className={`flex items-center justify-center rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition
                  ${isPiutang
                    ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-violet-500/20'
                    : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'}`}
              >
                {isPiutang ? 'Terima' : 'Bayar'}
              </button>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 shadow-sm">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </div>
      </div>

              {isExpanded && (
          <div className="overflow-hidden assets-accordion">
            <div className="pt-3 pb-1 space-y-2 mt-2">
              {(status === 'partial') && (
                <div className="px-1 mb-3">
                  <ProgressBar paid={totalPaid} total={totalNominal} color={isPiutang ? "violet" : "rose"} />
                </div>
              )}
              <DataTable
                columns={[
                  { label: 'Kategori' },
                  { label: 'Tanggal' },
                  { label: 'Nominal', align: 'right' }
                ]}
                data={rows}
                onEdit={onEdit}
                onDelete={onDelete}
                renderDesktopRow={(tx) => (
                  <>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{tx.category}</span>
                        {tx.isInitial && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-md">Sebelum App</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">{tx.date}</td>
                    <td className={`px-5 py-4 text-right font-outfit font-semibold text-sm ${isPiutang ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatMoney(tx.amount)}
                    </td>
                  </>
                )}
                renderMobileCard={(tx) => (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{tx.category}</span>
                        {tx.isInitial && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-md">Sebelum App</span>}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">{tx.date}</span>
                    </div>
                    <div className={`font-bold text-sm ${isPiutang ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatMoney(tx.amount)}
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}
          </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
const AssetsPage = memo(function AssetsPage({ onEdit, onDelete, onAdd, onSaveTransaction, onUpdateTransaction }) {
  const { t, privacyMode } = useLanguage()
  const fmt = (v) => displayIDR(v, privacyMode)

  const { transactions, accounts, totalAset, piutangBerjalan, utangBerjalan, netWorthData, totalBalance, monthlyStats } = useFinancial()
  const [filter, setFilter] = useState('Semua')
  const [settleModal, setSettleModal] = useState(null)
  const [payDebtModal, setPayDebtModal] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})

  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  // ── Data separation ──
  const assetTxs = transactions.filter(t => t.type === 'asset' && t.category !== 'Settlement')
  const debtTxs = transactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan')
  const piutangTxs = transactions.filter(t => t.type === 'transfer' && isPiutangCategory(t.category))
  const settlements = transactions.filter(t => t.type === 'asset' && t.category === 'Settlement')
  const debtPayments = transactions.filter(t => t.type === 'debt' && t.category === 'Pelunasan')

  // ── Settlement & payment maps ──
  const settledMap = useMemo(() => {
    const map = {}
    settlements.forEach(s => {
      if (s.settledPiutangId) {
        map[s.settledPiutangId] = (map[s.settledPiutangId] || 0) + s.amount
      }
    })
    return map
  }, [settlements])

  const paidDebtMap = useMemo(() => {
    const map = {}
    debtPayments.forEach(p => {
      if (p.settledDebtId) {
        map[p.settledDebtId] = (map[p.settledDebtId] || 0) + p.amount
      }
    })
    return map
  }, [debtPayments])

  // ── Piutang: kelompokkan per note (nama orang/lembaga) ──
  const piutangGroups = useMemo(() => {
    const groups = {}
    piutangTxs.forEach(tx => {
      const key = (tx.note || tx.category || 'Lainnya').trim()
      if (!groups[key]) groups[key] = { rows: [], totalNominal: 0, totalPaid: 0 }
      groups[key].rows.push(tx)
      groups[key].totalNominal += tx.amount
      groups[key].totalPaid += (settledMap[tx.id] || 0)
    })
    return Object.entries(groups).sort(([, a], [, b]) => {
      // Urutkan: yang belum lunas dulu
      const remA = a.totalNominal - a.totalPaid
      const remB = b.totalNominal - b.totalPaid
      return remB - remA
    })
  }, [piutangTxs, settledMap])

  // ── Utang: kelompokkan per note (nama bank/orang) ──
  const debtGroups = useMemo(() => {
    const groups = {}
    debtTxs.forEach(tx => {
      const key = (tx.note || tx.category || 'Lainnya').trim()
      if (!groups[key]) groups[key] = { rows: [], totalNominal: 0, totalPaid: 0 }
      groups[key].rows.push(tx)
      groups[key].totalNominal += tx.amount
      groups[key].totalPaid += (paidDebtMap[tx.id] || 0)
    })
    return Object.entries(groups).sort(([, a], [, b]) => {
      const remA = a.totalNominal - a.totalPaid
      const remB = b.totalNominal - b.totalPaid
      return remB - remA
    })
  }, [debtTxs, paidDebtMap])

  // ── Aset: kelompokkan per note (jenis investasi/aset) ──
  const asetGroups = useMemo(() => {
    const groups = {}
    assetTxs.forEach(tx => {
      const key = (tx.note || tx.category || 'Lainnya').trim()
      if (!groups[key]) groups[key] = { rows: [], total: 0, category: tx.category }
      groups[key].rows.push(tx)
      groups[key].total += tx.amount
    })
    return Object.entries(groups).sort(([, a], [, b]) => b.total - a.total)
  }, [assetTxs])

  // ── Aset totals per category ──
  const asetByLevel = useMemo(() => {
    const m = { 'Fisik': 0, 'Kas': 0, 'Investasi': 0 }
    assetTxs.forEach(tx => {
      const cat = tx.category || 'Lainnya'
      m[cat] = (m[cat] || 0) + tx.amount
    })
    return m
  }, [assetTxs])

  // ── Piutang & Utang stats ──
  const piutangTotal = piutangBerjalan
  const utangTotal = utangBerjalan
  const netAset = totalAset + piutangBerjalan - utangBerjalan

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonthStats = monthlyStats[currentMonthKey] || { debit: 0, credit: 0 }
  const currentMonthNetFlow = currentMonthStats.debit - currentMonthStats.credit
  const saldoBulanLalu = totalBalance - currentMonthNetFlow

  // ── Toggle group expand ──
  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Settle Piutang Handler ──
  const handleSettleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const amount = Number(formData.get('amount'))
    const accountId = formData.get('accountId')
    if (!amount || !accountId) return

    // Cari tx dengan note yang cocok
    const targetTx = settleModal.representativeTx
    const settlementPayload = {
      type: 'asset', category: 'Settlement',
      amount, accountId,
      note: `Pelunasan untuk: ${settleModal.label}`,
      date: new Date().toISOString().split('T')[0],
      isInitial: false,
      settledPiutangId: targetTx.id,
    }
    await onSaveTransaction(settlementPayload)

    const existing = settledMap[targetTx.id] || 0
    if (onUpdateTransaction && targetTx.id && (existing + amount) >= targetTx.amount) {
      await onUpdateTransaction(targetTx.id, { settled: true, settledAt: new Date().toISOString(), settledBy: accountId })
    }
    setSettleModal(null)
  }

  // ── Pay Utang Handler ──
  const handlePayDebtSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const amount = Number(formData.get('amount'))
    const accountId = formData.get('accountId')
    if (!amount || !accountId) return

    const targetTx = payDebtModal.representativeTx
    const paymentPayload = {
      type: 'debt', category: 'Pelunasan',
      amount, accountId,
      note: `Bayar utang untuk: ${payDebtModal.label}`,
      date: new Date().toISOString().split('T')[0],
      isInitial: false,
      settledDebtId: targetTx.id,
    }
    await onSaveTransaction(paymentPayload)

    const existing = paidDebtMap[targetTx.id] || 0
    if (onUpdateTransaction && targetTx.id && (existing + amount) >= targetTx.amount) {
      await onUpdateTransaction(targetTx.id, { settled: true, settledAt: new Date().toISOString(), settledBy: accountId })
    }
    setPayDebtModal(null)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <section className="space-y-6">

      {/* ── Net Asset Banner (Card 1) ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 border border-slate-700/50 p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Total Nilai Aset</div>
          <div className={`text-3xl font-bold tracking-tight ${netAset >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {displayIDR(netAset, privacyMode)}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Rincian Piutang</div>
            <div className="text-base font-semibold text-amber-400">{displayIDR(piutangBerjalan, privacyMode)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Rincian Utang</div>
            <div className="text-base font-semibold text-rose-400">{displayIDR(utangBerjalan, privacyMode)}</div>
          </div>
        </div>
      </div>

      {/* ── Summary Cards (Card 2, 3, 4) ── */}
      <div className="grid gap-3 grid-cols-2">
        <SummaryCard label="Aset Fisik" value={asetByLevel['Fisik'] || 0} icon={Package} color="emerald" privacyMode={privacyMode} />
        <SummaryCard label="Investasi" value={asetByLevel['Investasi'] || 0} icon={TrendingUp} color="blue" privacyMode={privacyMode} />

        {/* Card 4: Saldo Bulan Lalu Full Width */}
        <div className="col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Saldo Sisa Bulan Lalu</span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-violet-500 dark:text-violet-400 truncate">
              {displayIDR(saldoBulanLalu, privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5">
        <div className="flex rounded-2xl bg-slate-50 dark:bg-slate-950 p-1 border border-slate-100 dark:border-slate-800 overflow-x-auto w-full">
          {['Semua', 'Aset', 'Piutang', 'Utang'].map((v) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition whitespace-nowrap ${filter === v ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ASET SECTION                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {(filter === 'Semua' || filter === 'Aset') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
              <Package className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-50">Aset</div>
              <div className="text-xs text-slate-400">{asetGroups.length} jenis aset tercatat</div>
            </div>
            <div className="ml-auto text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalAset)}</div>
          </div>

          {asetGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">{t('no_assets_yet', 'Belum ada aset tercatat.')}</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {asetGroups
                .map(([key, g]) => {
                  const isExp = !!expandedGroups[`asset_${key}`]
                  return (
                    <div key={key} className="border-b border-slate-100 dark:border-slate-800/80 last:border-0 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <div className="cursor-pointer" onClick={() => toggleGroup(`asset_${key}`)}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-base font-bold shadow-sm">
                              {key?.charAt(0)?.toUpperCase() || 'A'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">{key}</div>
                              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{g.category} · {g.rows.length} input</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-600/70 dark:text-emerald-400/70 mb-1">
                              Total Nilai Aset
                            </div>
                            <span className="font-bold text-lg leading-none text-emerald-600 dark:text-emerald-400">
                              {fmt(g.total)}
                            </span>
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 shadow-sm">
                            {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>

                                              {isExp && (
                          <div className="overflow-hidden assets-accordion">
                            <div className="pt-3 pb-1 space-y-2 mt-2">
                              <DataTable
                                columns={[
                                  { label: 'Kategori' },
                                  { label: 'Tanggal' },
                                  { label: 'Nominal', align: 'right' }
                                ]}
                                data={g.rows}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                renderDesktopRow={(tx) => (
                                  <>
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{tx.category}</span>
                                        {tx.isInitial && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-md">Sebelum App</span>}
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs">{tx.date}</td>
                                    <td className="px-5 py-4 text-right font-outfit font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                                      {fmt(tx.amount)}
                                    </td>
                                  </>
                                )}
                                renderMobileCard={(tx) => (
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{tx.category}</span>
                                        {tx.isInitial && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-md">Sebelum App</span>}
                                      </div>
                                      <span className="text-[10px] font-medium text-slate-400">{tx.date}</span>
                                    </div>
                                    <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                      {fmt(tx.amount)}
                                    </div>
                                  </div>
                                )}
                              />
                            </div>
                          </div>
                        )}
                                          </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PIUTANG SECTION                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {(filter === 'Semua' || filter === 'Piutang') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-50">Piutang</div>
              <div className="text-xs text-slate-400">{piutangGroups.length} pihak · dikelompokkan per nama</div>
            </div>
            <div className="ml-auto text-sm font-bold text-violet-600 dark:text-violet-400">{fmt(piutangBerjalan)}</div>
          </div>

          {piutangGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">{t('no_receivable_yet', 'Belum ada piutang tercatat.')}</div>
          ) : (
            <div>
              {piutangGroups.map(([key, g]) => (
                <GroupedRow
                  key={key}
                  label={key}
                  rows={g.rows}
                  totalNominal={g.totalNominal}
                  totalPaid={g.totalPaid}
                  type="piutang"
                  onSettle={(tx) => setSettleModal({ label: key, representativeTx: tx, remaining: Math.max(0, g.totalNominal - g.totalPaid) })}
                  onPay={() => { }}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  formatMoney={fmt}
                  isExpanded={!!expandedGroups[`piutang_${key}`]}
                  onToggle={() => toggleGroup(`piutang_${key}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* UTANG SECTION                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {(filter === 'Semua' || filter === 'Utang') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10">
              <CreditCard className="h-4 w-4 text-rose-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-50">Utang</div>
              <div className="text-xs text-slate-400">{debtGroups.length} pihak · dikelompokkan per nama</div>
            </div>
            <div className="ml-auto text-sm font-bold text-rose-600 dark:text-rose-400">{fmt(utangBerjalan)}</div>
          </div>

          {debtGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">{t('no_debt_yet', 'Belum ada utang tercatat.')}</div>
          ) : (
            <div>
              {debtGroups.map(([key, g]) => (
                <GroupedRow
                  key={key}
                  label={key}
                  rows={g.rows}
                  totalNominal={g.totalNominal}
                  totalPaid={g.totalPaid}
                  type="debt"
                  onSettle={() => { }}
                  onPay={(tx) => setPayDebtModal({ label: key, representativeTx: tx, remaining: Math.max(0, g.totalNominal - g.totalPaid) })}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  formatMoney={fmt}
                  isExpanded={!!expandedGroups[`debt_${key}`]}
                  onToggle={() => toggleGroup(`debt_${key}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SETTLE PIUTANG MODAL                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
              {settleModal && (() => {
          const remaining = settleModal.remaining
          return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
              <div className="modal-enter w-full max-w-md rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
                <div className="mb-6">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">Terima Pelunasan</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Dari: <span className="font-semibold text-slate-700 dark:text-slate-300">{settleModal.label}</span>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Sisa piutang: <span className="font-bold text-violet-600 dark:text-violet-400">{fmt(remaining)}</span>
                  </div>
                </div>
                <form onSubmit={handleSettleSubmit} className="space-y-5">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Jumlah Diterima (Rp)</div>
                    <input name="amount" type="number" defaultValue={remaining} max={remaining} min={1} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition" required />
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Masuk ke Akun</div>
                    <select name="accountId" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition" required>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setSettleModal(null)} className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Batal</button>
                    <button type="submit" className="flex-1 rounded-2xl bg-violet-500 hover:bg-violet-600 py-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition">Simpan Pelunasan</button>
                  </div>
                </form>
              </div>
            </div>
          )
        })()}
      
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PAY UTANG MODAL                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
              {payDebtModal && (() => {
          const remaining = payDebtModal.remaining
          return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
              <div className="modal-enter w-full max-w-md rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
                <div className="mb-6">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">Bayar Utang</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Kepada: <span className="font-semibold text-slate-700 dark:text-slate-300">{payDebtModal.label}</span>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Sisa utang: <span className="font-bold text-rose-600 dark:text-rose-400">{fmt(remaining)}</span>
                  </div>
                </div>
                <form onSubmit={handlePayDebtSubmit} className="space-y-5">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Jumlah Dibayar (Rp)</div>
                    <input name="amount" type="number" defaultValue={remaining} max={remaining} min={1} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition" required />
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Bayar dari Akun</div>
                    <select name="accountId" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition" required>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setPayDebtModal(null)} className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Batal</button>
                    <button type="submit" className="flex-1 rounded-2xl bg-rose-500 hover:bg-rose-600 py-4 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition">Bayar Utang</button>
                  </div>
                </form>
              </div>
            </div>
          )
        })()}
      
    </section>
  )
})

export default AssetsPage