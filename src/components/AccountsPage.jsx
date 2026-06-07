import { memo } from 'react';
import { PlusCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { formatIDR, displayIDR } from '../utils/constants.js';
import { useFinancial } from '../contexts/FinancialContext.jsx';

export const AccountsPage = memo(function AccountsPage({ onAdd, onUpdate, onDelete, onAdjust }) {
  const { t, privacyMode } = useLanguage();
  const { accounts } = useFinancial();
  
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 lg:p-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('accounts')}</div>
          <div className="mt-1 text-xl font-outfit font-semibold">{accounts.length} {t('registered_accounts')}</div>
        </div>
        <button type="button" onClick={onAdd} className="flex items-center gap-2 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20 text-slate-900 px-5 py-3 text-sm font-outfit font-semibold hover:opacity-90">
          <PlusCircle className="h-4 w-4" /> {t('add_acc')}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map(acc => (
          <div key={acc.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 lg:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{acc.icon}</span>
                <div>
                  <div className="font-outfit font-semibold">{acc.name}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{t(`acc_type_${acc.type.toLowerCase().replace('-', '')}`, acc.type)}</div>
                </div>
              </div>
              <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">{t(`acc_type_${acc.type.toLowerCase().replace('-', '')}`, acc.type)}</span>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('real_balance')}</div>
              <div className={`text-2xl font-outfit font-semibold ${acc.currentBalance >= 0 ? 'text-emerald-400' : 'text-rose-400 font-outfit font-semibold'}`}>
                {displayIDR(acc.currentBalance, privacyMode)}
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
})
