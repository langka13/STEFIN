import { useState, useEffect, memo } from 'react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, Eye, EyeOff,
  Wallet, CreditCard, PieChart as PieIcon, BarChart2, Calendar,
  AlertCircle, CheckCircle2, Info, Edit3, Trash2, Settings, Plus
} from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import { PIE_COLORS, monthLabel, displayIDR, isPiutangCategory } from '../utils/constants.js'
import { useFinancial } from '../contexts/FinancialContext.jsx'

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, privacyMode }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-50">
            {displayIDR(entry.value, privacyMode)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, trend, trendVal, icon: Icon, accent, privacyMode }) => {
  const isPositive = trend === 'up'
  const accentMap = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', val: 'text-emerald-600 dark:text-emerald-400' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-500/10', icon: 'text-rose-500 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-500/20', val: 'text-rose-600 dark:text-rose-400' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', icon: 'text-blue-500 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-500/20', val: 'text-blue-600 dark:text-blue-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', icon: 'text-amber-500 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-500/20', val: 'text-amber-600 dark:text-amber-400' },
  }
  const c = accentMap[accent] || accentMap.emerald

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${c.icon}`} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-right leading-tight">{label}</p>
      </div>
      <p className={`text-base sm:text-lg font-bold tracking-tight ${c.val} tabular-nums`}>
        {displayIDR(value, privacyMode)}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
)

// ─── Cashflow Row ─────────────────────────────────────────────────────────────
const CashflowRow = ({ label, value, type, privacyMode }) => {
  if (!value || value === 0) return null
  const isIn = type === 'in'
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${
        isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
      }`}>
        {isIn ? '+' : '-'}{displayIDR(value, privacyMode)}
      </span>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { PeriodSelectorCard } from './PeriodSelectorCard.jsx'
import ConversationalEntry from './ConversationalEntry.jsx'
import EmptyState from './EmptyState.jsx'
import DataTable from './DataTable.jsx'

export const DashboardPage = memo(function DashboardPage({ theme, user, onEdit, onDelete }) {
  const { t, privacyMode, togglePrivacyMode } = useLanguage()
  const {
    transactions, accounts, totalBalance, netWorth, filteredTx,
    currentStats, currentSavings, currentCashIn, currentCashOut,
    currentNetFlow, savingsRate, chartData, expensePieData,
    incomeByCategory, expenseByCategory,
    filterMonth, assistantMsgs, dateRange,
    // Ekspor detail Net Worth
    totalAset, piutangBerjalan, utangBerjalan
  } = useFinancial()
  const accMap = useMemo(() => Object.fromEntries((accounts || []).map(a => [a.id, a])), [accounts])

  const [dashTxFilter, setDashTxFilter] = useState('all')
  const displayFilteredTx = useMemo(() => {
    let list = filteredTx || [];
    if (dashTxFilter === 'asset') {
      list = list.filter(tx => tx.type === 'asset' || tx.type === 'transfer' || tx.type === 'debt');
    } else if (dashTxFilter !== 'all') {
      list = list.filter(tx => tx.type === dashTxFilter);
    }
    return list;
  }, [filteredTx, dashTxFilter]);

  const navigateSmartEntry = (text) => window.dispatchEvent(new CustomEvent('stefin_navigate_smart_entry', { detail: text }));

  const isDark = theme === 'dark'
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
  const tooltipStyle = {
    background: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
    borderRadius: 16, fontSize: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
  }

  return (
    <div className="space-y-6 pb-8">
      <ConversationalEntry />

      {/* ── TOP HERO ROW ──────────────────────────────────────────────────── */}
      <div className="mb-4">
        {/* Net Worth — hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 dark:from-slate-900 dark:to-slate-950 border border-slate-800/50 p-5 sm:p-6 shadow-xl mb-4">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {t('net_worth_label')}
                </span>
                <button onClick={togglePrivacyMode} className="rounded-lg p-1 text-slate-500 hover:text-slate-300 transition-colors">
                  {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            </div>

            <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {displayIDR(netWorth, privacyMode)}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {t('remaining_balance')}: <span className="text-slate-200 font-medium">{displayIDR(totalBalance, privacyMode)}</span>
            </p>

            {/* Savings rate pill */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5">
              <div className={`h-1.5 w-16 sm:w-20 rounded-full bg-white/10 overflow-hidden`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${savingsRate >= 20 ? 'bg-emerald-400' : savingsRate >= 0 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-300">
                {t('savings_label')} {savingsRate}%
              </span>
            </div>
          </div>
        </div>

        {/* ── FILTER PERIODE ── */}
        <div className="bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center sm:justify-start mb-4">
          <PeriodSelectorCard />
        </div>

        {/* ── METRIK LAINNYA ── */}
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          {/* Income (Total Uang Masuk) */}
        <StatCard
          label={t('tx_income')}
          value={currentCashIn}
          sub={`Bulan ${monthLabel(filterMonth).split(' ')[0]}`}
          trend="up"
          icon={TrendingUp}
          accent="emerald"
          privacyMode={privacyMode}
        />

        {/* Expense (Total Uang Keluar) */}
        <StatCard
          label={t('tx_expense')}
          value={currentCashOut}
          sub={`${Math.round((currentCashOut / (currentCashIn || 1)) * 100)}% d. pemasukan`}
          trend={currentCashOut > currentCashIn ? 'up' : 'down'}
          icon={TrendingDown}
          accent="rose"
          privacyMode={privacyMode}
        />

        {/* Analisis Kas (Rata-rata & Saving) */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('cash_analysis')}</p>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('avg_per_day')}</p>
              </div>
              <p className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-300 leading-none tabular-nums mt-1">
                {displayIDR(currentCashOut / new Date(dateRange.start.getFullYear(), dateRange.start.getMonth() + 1, 0).getDate(), privacyMode)}
              </p>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('total_saving_asset')}</p>
              </div>
              <p className="text-sm sm:text-base font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-none tabular-nums mt-1">
                {displayIDR(currentSavings, privacyMode)}
              </p>
            </div>
          </div>
        </div>

        {/* Utang & Piutang */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <AlertCircle className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('credit_label')}</p>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('debt_label')}</p>
              </div>
              <p className="text-base sm:text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400 leading-none tabular-nums">
                {displayIDR(utangBerjalan, privacyMode)}
              </p>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('receivable_label')}</p>
              </div>
              <p className="text-base sm:text-lg font-bold tracking-tight text-blue-600 dark:text-blue-400 leading-none tabular-nums">
                {displayIDR(piutangBerjalan, privacyMode)}
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ── ACCOUNTS ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm mb-4">
        {/* Compact header: title left, actions right */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{t('funding_source')}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('stefin_navigate_add_account'))}
              title="Tambah Akun"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('stefin_navigate_accounts'))}
              title="Kelola Dompet"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Account list — horizontal scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar">
          {(accounts || []).map(acc => (
            <div key={acc.id} className="flex-shrink-0 flex flex-col items-start gap-0.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 min-w-[120px]">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[108px]">{acc.name}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-50 tabular-nums">{displayIDR(acc.currentBalance || 0, privacyMode)}</span>
            </div>
          ))}
          {(!accounts || accounts.length === 0) && (
            <p className="text-xs text-slate-400 py-2">{t('no_accounts')}</p>
          )}
        </div>
      </div>

      {/* ── MAIN CHART + CASHFLOW (COMBINED) ───────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm mb-4">
        <SectionHeader
          icon={BarChart2}
          title={t('cashflow_trend')}
          subtitle={`${t('cashflow_summary')} ${monthLabel(filterMonth)}`}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Area Chart */}
          <div className="lg:col-span-2">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip content={<CustomTooltip privacyMode={privacyMode} />} />
                  <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gInc)" strokeWidth={2.5} name={t('tx_income')} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                  <Area type="monotone" dataKey="expense" stroke="#f43f5e" fill="url(#gExp)" strokeWidth={2.5} name={t('tx_expense')} dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex justify-center items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="h-2 w-2 rounded-full bg-emerald-500" /> {t('tx_income')}</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="h-2 w-2 rounded-full bg-rose-500" /> {t('tx_expense')}</div>
            </div>
          </div>

          {/* Cashflow Details */}
          <div className="lg:col-span-1 space-y-4">
            {/* Debit */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-3 sm:px-4">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Debit</span>
              </div>
              <div className="space-y-1">
                <CashflowRow label={t('tx_income')} value={currentStats.income} type="in" privacyMode={privacyMode} />
                <CashflowRow label={t('asset_settlement')} value={currentStats.piutangIn} type="in" privacyMode={privacyMode} />
                <CashflowRow label={t('debt_in_req')} value={currentStats.debtIn} type="in" privacyMode={privacyMode} />
                <div className="flex items-center justify-between py-2 pt-2 mt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{displayIDR(currentCashIn, privacyMode)}</span>
                </div>
              </div>
            </div>

            {/* Kredit */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-3 sm:px-4">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Kredit</span>
              </div>
              <div className="space-y-1">
                <CashflowRow label={t('tx_expense')} value={currentStats.expense} type="out" privacyMode={privacyMode} />
                <CashflowRow label={t('receivable_given')} value={currentStats.piutangOut} type="out" privacyMode={privacyMode} />
                <CashflowRow label={t('asset_bought')} value={currentStats.assetOut} type="out" privacyMode={privacyMode} />
                <CashflowRow label={t('debt_settlement')} value={currentStats.debtOut} type="out" privacyMode={privacyMode} />
                <div className="flex items-center justify-between py-2 pt-2 mt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total</span>
                  <span className="text-sm font-bold text-rose-500 dark:text-rose-400">-{displayIDR(currentCashOut, privacyMode)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── ALOKASI PIE CHARTS (DONUTS) ──────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm mb-4">
        <SectionHeader icon={PieIcon} title={t('financial_allocation')} subtitle={t('financial_allocation_sub')} />
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Income Donut */}
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center sm:text-left">{t('tx_income')}</div>
            {incomeByCategory.length > 0 ? (
              <>
                <div className="h-40 sm:h-44 -mx-2">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie data={incomeByCategory} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                        {incomeByCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={v => displayIDR(v, privacyMode)} itemStyle={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {incomeByCategory.slice(0, 4).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{d.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-2 shrink-0">{displayIDR(d.value, privacyMode)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{t('no_income')}</p>
              </div>
            )}
          </div>

          {/* Expense Donut */}
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center sm:text-left">{t('tx_expense')}</div>
            {expensePieData.length > 0 ? (
              <>
                <div className="h-40 sm:h-44 -mx-2">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie data={expensePieData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                        {expensePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={v => displayIDR(v, privacyMode)} itemStyle={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {expensePieData.slice(0, 4).map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{d.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-2 shrink-0">{displayIDR(d.value, privacyMode)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{t('no_expense')}</p>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* ── TRANSACTION HISTORY TABLE (BOTTOM) ─────────────────────────────────────────────── */}
      <div className="grid gap-3 mb-8">
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">{t('dashboard_tx_history')}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('dashboard_tx_history_sub')} ({displayFilteredTx.length})</p>
              </div>
            </div>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/50 p-1">
              {[['all', t('tx_all', 'Semua')], ['income', t('tx_income', 'Masuk')], ['expense', t('tx_expense', 'Keluar')], ['asset', t('my_assets', 'Aset')]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setDashTxFilter(v)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${dashTxFilter === v ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          
          {displayFilteredTx.length === 0 ? (
             <div className="py-12">
               <EmptyState 
                  message={t('no_transactions')}
                  actions={[
                    { label: t('record_income'), value: 'Pemasukan: ' },
                    { label: t('record_expense'), value: 'Pengeluaran: ' },
                  ]}
                  onAction={(action) => navigateSmartEntry(action.value)}
               />
             </div>
          ) : (
            <DataTable 
              columns={[
                { label: 'Tanggal' },
                { label: 'Kategori' },
                { label: 'Keterangan' },
                { label: 'Akun' },
                { label: 'Nominal', align: 'right' }
              ]}
              data={displayFilteredTx.slice(0, 10)}
              onEdit={onEdit}
              onDelete={onDelete}
              renderDesktopRow={(tx) => {
                const sourceAcc = accMap[tx.accountId]?.name || 'Akun Terhapus';
                const targetAcc = tx.targetAccountId ? (accMap[tx.targetAccountId]?.name || 'Akun Terhapus') : null;
                const accText = targetAcc ? `${sourceAcc} → ${targetAcc}` : sourceAcc;
                
                return (
                  <>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{tx.date}</td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-50 capitalize">{tx.category}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {tx.type === 'income' ? t('tx_income') : tx.type === 'expense' ? t('tx_expense') : tx.type === 'transfer' ? isPiutangCategory(tx.category) ? t('receivables') : t('tx_transfer') : tx.type === 'debt' ? (tx.category === 'Pelunasan' ? t('debt_settlement') : t('tx_debt')) : tx.category === 'Settlement' ? t('asset_settlement') : t('tx_asset')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300 text-xs">
                      {tx.note ? <span className="line-clamp-1 max-w-[200px]">{tx.note}</span> : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {accText}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-right font-medium text-sm whitespace-nowrap ${tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false)
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : (tx.type === 'transfer' && isPiutangCategory(tx.category) && tx.isInitial) || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial)
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-rose-500 dark:text-rose-400'
                      }`}>
                      {tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false) ? '+' : '-'}{displayIDR(tx.amount, privacyMode)}
                    </td>
                  </>
                );
              }}
              renderMobileCard={(tx) => {
                const sourceAcc = accMap[tx.accountId]?.name || 'Akun Terhapus';
                const targetAcc = tx.targetAccountId ? (accMap[tx.targetAccountId]?.name || 'Akun Terhapus') : null;
                const accText = targetAcc ? `${sourceAcc} → ${targetAcc}` : sourceAcc;

                return (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">{tx.category}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {tx.note ? `${tx.note} • ` : ''}{accText}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{tx.date}</span>
                    </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-bold text-sm ${tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false)
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : (tx.type === 'transfer' && isPiutangCategory(tx.category) && tx.isInitial) || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial)
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-rose-500 dark:text-rose-400'
                      }`}>
                      {tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false) ? '+' : '-'}{displayIDR(tx.amount, privacyMode)}
                    </span>
                    <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(tx); }} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 transition">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

    </div>
  )
})
