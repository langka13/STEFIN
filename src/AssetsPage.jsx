import { useState, useMemo } from 'react'
import { PlusCircle, Edit3, Trash2, CheckCircle, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const formatIDR = (v) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v||0)

// ── Reusable Progress Bar ──
function ProgressBar({ paid, total, color = 'emerald' }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const colorMap = {
    emerald: { bar: 'bg-emerald-500', track: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
    rose:    { bar: 'bg-rose-500',    track: 'bg-rose-100 dark:bg-rose-500/20',    text: 'text-rose-600 dark:text-rose-400' },
    amber:   { bar: 'bg-amber-500',   track: 'bg-amber-100 dark:bg-amber-500/20',   text: 'text-amber-600 dark:text-amber-400' },
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

export default function AssetsPage({ transactions, accounts, totalBalance, netWorth, onEdit, onDelete, onAdd, onSaveTransaction, onUpdateTransaction }) {
  const [filter, setFilter] = useState('Semua')
  const [settleModal, setSettleModal] = useState(null)       // Piutang
  const [payDebtModal, setPayDebtModal] = useState(null)     // Utang

  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  // ── Data separation ──
  const assetTxs = transactions.filter(t => t.type === 'asset' && t.category !== 'Settlement')
  const debtTxs = transactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan')
  const piutangTxs = transactions.filter(t => t.type === 'transfer' && t.category === 'Piutang')
  const settlements = transactions.filter(t => t.type === 'asset' && t.category === 'Settlement')
  const debtPayments = transactions.filter(t => t.type === 'debt' && t.category === 'Pelunasan')

  // ── Piutang: settled amounts map ──
  const settledMap = useMemo(() => {
    const map = {}
    settlements.forEach(s => {
      if (s.settledPiutangId) {
        if (!map[s.settledPiutangId]) map[s.settledPiutangId] = 0
        map[s.settledPiutangId] += s.amount
      }
    })
    return map
  }, [settlements])

  // ── Utang: paid amounts map ──
  const paidDebtMap = useMemo(() => {
    const map = {}
    debtPayments.forEach(p => {
      if (p.settledDebtId) {
        if (!map[p.settledDebtId]) map[p.settledDebtId] = 0
        map[p.settledDebtId] += p.amount
      }
    })
    return map
  }, [debtPayments])

  // ── Status helpers ──
  const getPiutangStatus = (tx) => {
    const s = settledMap[tx.id] || 0
    if (s >= tx.amount) return 'paid'
    if (s > 0) return 'partial'
    return 'unpaid'
  }
  const getSettledAmount = (tx) => settledMap[tx.id] || 0
  const getPiutangRemaining = (tx) => Math.max(0, tx.amount - (settledMap[tx.id] || 0))

  const getDebtStatus = (tx) => {
    const p = paidDebtMap[tx.id] || 0
    if (p >= tx.amount) return 'paid'
    if (p > 0) return 'partial'
    return 'unpaid'
  }
  const getPaidDebtAmount = (tx) => paidDebtMap[tx.id] || 0
  const getDebtRemaining = (tx) => Math.max(0, tx.amount - (paidDebtMap[tx.id] || 0))

  // ── Totals ──
  const totalPiutang = piutangTxs.reduce((sum, t) => sum + t.amount, 0) - settlements.reduce((sum, t) => sum + t.amount, 0)
  const totalPhysicalAssets = assetTxs.reduce((sum, t) => sum + t.amount, 0)
  const totalAssets = totalPhysicalAssets + totalPiutang
  const totalDebts = debtTxs.reduce((sum, t) => sum + t.amount, 0) - debtPayments.reduce((sum, t) => sum + t.amount, 0)

  // ── Progress stats ──
  const piutangStats = useMemo(() => {
    const total = piutangTxs.length
    const paid = piutangTxs.filter(t => getPiutangStatus(t) === 'paid').length
    const partial = piutangTxs.filter(t => getPiutangStatus(t) === 'partial').length
    const totalNominal = piutangTxs.reduce((s, t) => s + t.amount, 0)
    const totalSettled = piutangTxs.reduce((s, t) => s + getSettledAmount(t), 0)
    return { total, paid, partial, unpaid: total - paid - partial, totalNominal, totalSettled }
  }, [piutangTxs, settledMap])

  const debtStats = useMemo(() => {
    const total = debtTxs.length
    const paid = debtTxs.filter(t => getDebtStatus(t) === 'paid').length
    const partial = debtTxs.filter(t => getDebtStatus(t) === 'partial').length
    const totalNominal = debtTxs.reduce((s, t) => s + t.amount, 0)
    const totalPaid = debtTxs.reduce((s, t) => s + getPaidDebtAmount(t), 0)
    return { total, paid, partial, unpaid: total - paid - partial, totalNominal, totalPaid }
  }, [debtTxs, paidDebtMap])

  // ── Filter ──
  const filteredData = [...assetTxs, ...piutangTxs, ...debtTxs].filter(t => {
    if (filter === 'Fisik') return t.type === 'asset' && t.category !== 'Piutang'
    if (filter === 'Piutang') return t.type === 'transfer' && t.category === 'Piutang'
    if (filter === 'Utang') return t.type === 'debt' && t.category !== 'Pelunasan'
    return true
  }).sort((a, b) => new Date(b.date) - new Date(a.date))

  // ══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════════

  const handleSettleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const amount = Number(formData.get('amount'))
    const accountId = formData.get('accountId')
    if (!amount || !accountId) return

    const settlementPayload = {
      type: 'asset', category: 'Settlement', sub: 'Pelunasan',
      amount, accountId,
      note: `Pelunasan untuk: ${settleModal.note || settleModal.sub}`,
      date: new Date().toISOString().split('T')[0],
      isInitial: false, settledPiutangId: settleModal.id,
    }
    await onSaveTransaction(settlementPayload)

    const existingSettled = settledMap[settleModal.id] || 0
    if (onUpdateTransaction && settleModal.id && (existingSettled + amount) >= settleModal.amount) {
      await onUpdateTransaction(settleModal.id, {
        settled: true, settledAt: new Date().toISOString(), settledBy: accountId,
      })
    }
    setSettleModal(null)
  }

  const handlePayDebtSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const amount = Number(formData.get('amount'))
    const accountId = formData.get('accountId')
    if (!amount || !accountId) return

    const paymentPayload = {
      type: 'debt', category: 'Pelunasan', sub: 'Bayar Utang',
      amount, accountId,
      note: `Bayar utang untuk: ${payDebtModal.note || payDebtModal.sub}`,
      date: new Date().toISOString().split('T')[0],
      isInitial: false, settledDebtId: payDebtModal.id,
    }
    await onSaveTransaction(paymentPayload)

    const existingPaid = paidDebtMap[payDebtModal.id] || 0
    if (onUpdateTransaction && payDebtModal.id && (existingPaid + amount) >= payDebtModal.amount) {
      await onUpdateTransaction(payDebtModal.id, {
        settled: true, settledAt: new Date().toISOString(), settledBy: accountId,
      })
    }
    setPayDebtModal(null)
  }

  // ── Quick pay all: directly save without modal ──
  const handleQuickSettleAll = async (tx) => {
    const remaining = getPiutangRemaining(tx)
    if (remaining <= 0) return
    const accountId = accounts[0]?.id
    if (!accountId) return
    const settlementPayload = {
      type: 'asset', category: 'Settlement', sub: 'Pelunasan',
      amount: remaining, accountId,
      note: `Pelunasan penuh untuk: ${tx.note || tx.sub}`,
      date: new Date().toISOString().split('T')[0],
      isInitial: false, settledPiutangId: tx.id,
    }
    await onSaveTransaction(settlementPayload)
    if (onUpdateTransaction && tx.id) {
      await onUpdateTransaction(tx.id, {
        settled: true, settledAt: new Date().toISOString(), settledBy: accountId,
      })
    }
  }

  const handleQuickPayAll = async (tx) => {
    const remaining = getDebtRemaining(tx)
    if (remaining <= 0) return
    const accountId = accounts[0]?.id
    if (!accountId) return
    const paymentPayload = {
      type: 'debt', category: 'Pelunasan', sub: 'Bayar Utang',
      amount: remaining, accountId,
      note: `Pelunasan penuh utang: ${tx.note || tx.sub}`,
      date: new Date().toISOString().split('T')[0],
      isInitial: false, settledDebtId: tx.id,
    }
    await onSaveTransaction(paymentPayload)
    if (onUpdateTransaction && tx.id) {
      await onUpdateTransaction(tx.id, {
        settled: true, settledAt: new Date().toISOString(), settledBy: accountId,
      })
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // BADGE COMPONENTS
  // ══════════════════════════════════════════════════════════════════

  const renderStatusBadge = (status) => {
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

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  return (
    <section className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Aset & Piutang */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Aset & Piutang</div>
          <div className="text-3xl font-outfit font-semibold text-emerald-500 dark:text-emerald-400">{formatIDR(totalAssets)}</div>
          {piutangStats.total > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Piutang: {piutangStats.paid}/{piutangStats.total} lunas</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(piutangStats.totalNominal > 0 ? (piutangStats.totalSettled / piutangStats.totalNominal) * 100 : 0)}%</span>
              </div>
              <ProgressBar paid={piutangStats.totalSettled} total={piutangStats.totalNominal} color="emerald" />
            </div>
          )}
        </div>

        {/* Utang */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 space-y-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Utang</div>
          <div className="text-3xl font-outfit font-semibold text-rose-500 dark:text-rose-400">{formatIDR(totalDebts)}</div>
          {debtStats.total > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Utang: {debtStats.paid}/{debtStats.total} lunas</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">{Math.round(debtStats.totalNominal > 0 ? (debtStats.totalPaid / debtStats.totalNominal) * 100 : 0)}%</span>
              </div>
              <ProgressBar paid={debtStats.totalPaid} total={debtStats.totalNominal} color="rose" />
            </div>
          )}
        </div>

        {/* Kekayaan Bersih */}
        <div className="rounded-3xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 p-6">
          <div className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Kekayaan Bersih</div>
          <div className={`mt-2 text-3xl font-outfit font-semibold ${netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatIDR(netWorth)}
          </div>
          <div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">Termasuk saldo kas {formatIDR(totalBalance)}</div>
        </div>
      </div>

      {/* ── Filter + Add ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        <div className="flex rounded-2xl bg-slate-50 dark:bg-slate-950 p-1 border border-slate-100 dark:border-slate-800">
          {['Semua', 'Fisik', 'Piutang', 'Utang'].map((v) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${filter===v?'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm':'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50'}`}>
              {v}
            </button>
          ))}
        </div>
        <button type="button" onClick={onAdd} className="flex items-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 text-sm font-outfit font-semibold shadow-lg shadow-emerald-500/20 transition">
          <PlusCircle className="h-4 w-4"/> Tambah Aset/Utang
        </button>
      </div>

      {/* ── Table ── */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400">Belum ada catatan aset atau utang.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {['Tanggal','Item','Tipe/Status','Sumber Dana','Nominal','Aksi'].map(h => (
                    <th key={h} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.map(tx => {
                  const isPiutang = tx.type === 'transfer' && tx.category === 'Piutang'
                  const isDebt = tx.type === 'debt' && tx.category !== 'Pelunasan'
                  const isAsset = tx.type === 'asset'
                  const piutangStatus = isPiutang ? getPiutangStatus(tx) : null
                  const debtStatus = isDebt ? getDebtStatus(tx) : null
                  const isRowFaded = (isPiutang && piutangStatus === 'paid') || (isDebt && debtStatus === 'paid')

                  return (
                  <tr key={tx.id} className={`transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${isRowFaded ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-medium">{tx.date}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{tx.sub || tx.category}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tx.note || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 items-center">
                        {isPiutang ? (
                          <>
                            <span className="rounded-md bg-violet-50 dark:bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase border border-violet-100 dark:border-violet-500/20">Piutang: {tx.sub}</span>
                            {tx.isInitial && <span className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase border border-amber-100 dark:border-amber-500/20">Sebelum SteFin</span>}
                            {renderStatusBadge(piutangStatus)}
                          </>
                        ) : isAsset ? (
                          <>
                            <span className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase border border-emerald-100 dark:border-emerald-500/20">Aset: {tx.category}</span>
                            {tx.isInitial && <span className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase border border-amber-100 dark:border-amber-500/20">Saldo Awal</span>}
                          </>
                        ) : isDebt ? (
                          <>
                            <span className="rounded-md bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase border border-rose-100 dark:border-rose-500/20">Utang: {tx.category}</span>
                            {tx.isInitial && <span className="rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase border border-amber-100 dark:border-amber-500/20">Sebelum SteFin</span>}
                            {renderStatusBadge(debtStatus)}
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {accMap[tx.accountId]?.name || tx.accountId}
                      </span>
                    </td>
                    {/* ── Nominal column with partial progress ── */}
                    <td className="px-6 py-4 text-right">
                      {isPiutang && piutangStatus === 'partial' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-outfit font-bold text-sm text-emerald-600 dark:text-emerald-400">{formatIDR(getPiutangRemaining(tx))}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through">{formatIDR(tx.amount)}</span>
                          <ProgressBar paid={getSettledAmount(tx)} total={tx.amount} color="amber" />
                        </div>
                      ) : isPiutang && piutangStatus === 'paid' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-outfit font-bold text-sm text-slate-400 dark:text-slate-500 line-through">{formatIDR(tx.amount)}</span>
                          <ProgressBar paid={tx.amount} total={tx.amount} color="emerald" />
                        </div>
                      ) : isDebt && debtStatus === 'partial' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-outfit font-bold text-sm text-rose-600 dark:text-rose-400">{formatIDR(getDebtRemaining(tx))}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through">{formatIDR(tx.amount)}</span>
                          <ProgressBar paid={getPaidDebtAmount(tx)} total={tx.amount} color="amber" />
                        </div>
                      ) : isDebt && debtStatus === 'paid' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-outfit font-bold text-sm text-slate-400 dark:text-slate-500 line-through">{formatIDR(tx.amount)}</span>
                          <ProgressBar paid={tx.amount} total={tx.amount} color="rose" />
                        </div>
                      ) : (
                        <span className={`font-outfit font-bold text-sm ${isPiutang || isAsset ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatIDR(tx.amount)}
                        </span>
                      )}
                    </td>
                    {/* ── Actions ── */}
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5">
                        {/* Piutang actions */}
                        {isPiutang && piutangStatus !== 'paid' && (
                          <>
                            <button type="button" onClick={() => setSettleModal(tx)} className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition">
                              Terima
                            </button>
                            {piutangStatus === 'partial' && (
                              <button type="button" onClick={() => handleQuickSettleAll(tx)} className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition" title="Lunasi semua sisa">
                                <Zap className="h-3.5 w-3.5"/>
                              </button>
                            )}
                          </>
                        )}
                        {/* Utang actions */}
                        {isDebt && debtStatus !== 'paid' && (
                          <>
                            <button type="button" onClick={() => setPayDebtModal(tx)} className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition">
                              Bayar
                            </button>
                            {debtStatus === 'partial' && (
                              <button type="button" onClick={() => handleQuickPayAll(tx)} className="grid h-8 w-8 place-items-center rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition" title="Lunasi semua sisa">
                                <Zap className="h-3.5 w-3.5"/>
                              </button>
                            )}
                          </>
                        )}
                        <button type="button" onClick={() => onEdit(tx)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:border-emerald-500 hover:text-emerald-500 transition">
                          <Edit3 className="h-3.5 w-3.5"/>
                        </button>
                        <button type="button" onClick={() => onDelete(tx.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:border-rose-500 hover:text-rose-500 transition">
                          <Trash2 className="h-3.5 w-3.5"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SETTLE PIUTANG MODAL                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {settleModal && (() => {
          const remaining = getPiutangRemaining(settleModal)
          const settled = getSettledAmount(settleModal)
          const pct = settleModal.amount > 0 ? Math.round((settled / settleModal.amount) * 100) : 0
          return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
            <motion.div initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:0.95}} className="w-full max-w-md rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
              <div className="mb-6">
                <div className="text-2xl font-outfit font-semibold text-slate-900 dark:text-slate-50">Terima Pelunasan Piutang</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-pretty">
                  Dari: <span className="font-semibold text-slate-700 dark:text-slate-300">{settleModal.note || settleModal.sub}</span>
                </div>
              </div>

              {/* Progress card */}
              <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-4 mb-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Progress Pelunasan</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{pct}%</span>
                </div>
                <ProgressBar paid={settled} total={settleModal.amount} color="emerald" />
                <div className="flex justify-between text-[11px] text-emerald-600/70 dark:text-emerald-400/70">
                  <span>Sudah diterima: {formatIDR(settled)}</span>
                  <span>Sisa: <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(remaining)}</span></span>
                </div>
              </div>

              <form onSubmit={handleSettleSubmit} className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Jumlah Diterima (Rp)</div>
                  <input name="amount" type="number" defaultValue={remaining} max={remaining} min={1} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" required />
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Masuk ke Akun</div>
                  <select name="accountId" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition" required>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setSettleModal(null)} className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Batal</button>
                  <button type="submit" className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition">
                    Simpan Pelunasan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
          )
        })()}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PAY UTANG MODAL                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {payDebtModal && (() => {
          const remaining = getDebtRemaining(payDebtModal)
          const paid = getPaidDebtAmount(payDebtModal)
          const pct = payDebtModal.amount > 0 ? Math.round((paid / payDebtModal.amount) * 100) : 0
          return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4">
            <motion.div initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:0.95}} className="w-full max-w-md rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
              <div className="mb-6">
                <div className="text-2xl font-outfit font-semibold text-slate-900 dark:text-slate-50">Bayar Utang</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-pretty">
                  Untuk: <span className="font-semibold text-slate-700 dark:text-slate-300">{payDebtModal.note || payDebtModal.sub}</span>
                </div>
              </div>

              {/* Progress card */}
              <div className="rounded-2xl border border-rose-100 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-4 mb-6 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-700 dark:text-rose-400 font-semibold">Progress Pembayaran</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{pct}%</span>
                </div>
                <ProgressBar paid={paid} total={payDebtModal.amount} color="rose" />
                <div className="flex justify-between text-[11px] text-rose-600/70 dark:text-rose-400/70">
                  <span>Sudah dibayar: {formatIDR(paid)}</span>
                  <span>Sisa: <span className="font-bold text-rose-700 dark:text-rose-400">{formatIDR(remaining)}</span></span>
                </div>
              </div>

              <form onSubmit={handlePayDebtSubmit} className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Jumlah Dibayar (Rp)</div>
                  <input name="amount" type="number" defaultValue={remaining} max={remaining} min={1} className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition" required />
                </div>
                <div>
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Bayar dari Akun</div>
                  <select name="accountId" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition" required>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setPayDebtModal(null)} className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Batal</button>
                  <button type="submit" className="flex-1 rounded-2xl bg-rose-500 hover:bg-rose-600 py-4 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition">
                    Bayar Utang
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
          )
        })()}
      </AnimatePresence>
    </section>
  )
}
