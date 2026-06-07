import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFinancial } from '../contexts/FinancialContext.jsx'
import { MONTHS_FULL } from '../utils/constants.js'
import { useMemo } from 'react'
import { useLanguage } from '../contexts/LanguageContext.jsx'

export function PeriodSelectorCard() {
  const { dateRange, setDateRange } = useFinancial()
  const { mode, start, end } = dateRange
  const { t } = useLanguage()

  const getWeekBounds = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const wStart = new Date(d.setDate(diff))
    wStart.setHours(0, 0, 0, 0)
    const wEnd = new Date(wStart)
    wEnd.setDate(wStart.getDate() + 6)
    wEnd.setHours(23, 59, 59, 999)
    return { start: wStart, end: wEnd }
  }

  const getMonthBounds = (year, month) => ({
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999)
  })

  const getYearBounds = (year) => ({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999)
  })

  const handleModeChange = (e) => {
    const newMode = e.target.value
    const now = new Date()
    let bounds
    if (newMode === 'weekly') bounds = getWeekBounds(now)
    else if (newMode === 'monthly') bounds = getMonthBounds(now.getFullYear(), now.getMonth())
    else if (newMode === 'yearly') bounds = getYearBounds(now.getFullYear())
    else bounds = getMonthBounds(now.getFullYear(), now.getMonth())
    setDateRange({ mode: newMode, start: bounds.start, end: bounds.end })
  }

  const shiftPeriod = (dir) => {
    if (mode === 'weekly') {
      const d = new Date(start)
      d.setDate(start.getDate() + dir * 7)
      setDateRange({ ...dateRange, ...getWeekBounds(d) })
    } else if (mode === 'monthly') {
      const d = new Date(start)
      d.setMonth(start.getMonth() + dir)
      setDateRange({ ...dateRange, ...getMonthBounds(d.getFullYear(), d.getMonth()) })
    } else if (mode === 'yearly') {
      setDateRange({ ...dateRange, ...getYearBounds(start.getFullYear() + dir) })
    }
  }

  const label = useMemo(() => {
    if (mode === 'weekly') return `${start.getDate()} ${MONTHS_FULL[start.getMonth()].substring(0,3)} – ${end.getDate()} ${MONTHS_FULL[end.getMonth()].substring(0,3)} ${end.getFullYear()}`
    if (mode === 'monthly') return `${MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`
    if (mode === 'yearly') return `${start.getFullYear()}`
    return t('period_custom', 'Kustom')
  }, [mode, start, end, t])

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Dropdown mode */}
      <select
        value={mode}
        onChange={handleModeChange}
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
      >
        <option value="weekly">{t('period_weekly', 'Mingguan')}</option>
        <option value="monthly">{t('period_monthly', 'Bulanan')}</option>
        <option value="yearly">{t('period_yearly', 'Tahunan')}</option>
        <option value="custom">{t('period_custom', 'Kustom')}</option>
      </select>

      {/* Nav or custom inputs */}
      {mode !== 'custom' ? (
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
          <button onClick={() => shiftPeriod(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{label}</span>
          <button onClick={() => shiftPeriod(1)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={start.toISOString().split('T')[0]}
            onChange={(e) => {
              if (e.target.value) {
                const [y,m,d] = e.target.value.split('-')
                setDateRange(r => ({ ...r, start: new Date(y, m-1, d, 0,0,0) }))
              }
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none w-[120px]"
          />
          <span className="text-slate-400 text-xs">–</span>
          <input
            type="date"
            value={end.toISOString().split('T')[0]}
            onChange={(e) => {
              if (e.target.value) {
                const [y,m,d] = e.target.value.split('-')
                setDateRange(r => ({ ...r, end: new Date(y, m-1, d, 23,59,59,999) }))
              }
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none w-[120px]"
          />
        </div>
      )}
    </div>
  )
}
