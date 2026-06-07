import React from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function EmptyState({ message, actions, onAction }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{message || t('no_transactions', 'Belum ada transaksi')}</p>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onAction && onAction(action)}
              className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition whitespace-nowrap"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
