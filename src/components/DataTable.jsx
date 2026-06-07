import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';

export default function DataTable({ 
  columns, 
  data, 
  emptyMessage, 
  onEdit, 
  onDelete, 
  renderMobileCard,
  renderDesktopRow
}) {
  const { t } = useLanguage();
  const finalEmptyMessage = emptyMessage || t('no_data_yet', 'Belum ada data');

  if (!data || data.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center px-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{finalEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ── DESKTOP VIEW (Table) ── */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {t(col.label, col.label)}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">
                  {t('action', 'Aksi')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {data.map((row, idx) => (
              <tr key={row.id || idx} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                {renderDesktopRow(row)}
                {(onEdit || onDelete) && (
                  <td className="px-5 py-4">
                    <div className="flex gap-2 justify-end">
                      {onEdit && (
                        <button 
                          type="button" 
                          onClick={() => onEdit(row)} 
                          className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors shadow-sm"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button 
                          type="button" 
                          onClick={() => onDelete(row.id)} 
                          className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-rose-500 hover:text-rose-500 transition-colors shadow-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE VIEW (Cards) ── */}
      <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
        {data.map((row, idx) => (
          <div key={row.id || idx} className="p-4 transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            {renderMobileCard(row)}

          </div>
        ))}
      </div>
    </div>
  );
}
