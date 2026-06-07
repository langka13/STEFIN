import { useState, useEffect } from 'react';

import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useFinancial } from '../contexts/FinancialContext.jsx';
import { displayIDR, verifyNumber, getCategoryOptions, isPiutangCategory } from '../utils/constants.js';

// Semua tipe pakai emerald (konsisten dengan design system app)

const FIELD = 'w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500 transition placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm';

export function TransactionModal({ tx, accounts, onSave, onClose }) {
  const { t, privacyMode } = useLanguage();
  const { preferences } = useFinancial();
  const customCategories = preferences?.customCategories || {};
  const isEdit = Boolean(tx && tx.id);

  const [type, setType]                   = useState(tx?.type || 'expense');
  const [category, setCategory]           = useState(tx?.category || '');
  const [accountId, setAccountId]         = useState(tx?.accountId || accounts[0]?.id || '');
  const [targetAccountId, setTargetAccountId] = useState(tx?.targetAccountId || '');
  const [amount, setAmount]               = useState(tx?.amount?.toString() || '');
  const [note, setNote]                   = useState(tx?.note || '');
  const [date, setDate]                   = useState(tx?.date || new Date().toISOString().split('T')[0]);
  const [isInitial, setIsInitial]         = useState(tx?.isInitial || false);
  const [saving, setSaving]               = useState(false);

  const categories = getCategoryOptions(type, customCategories);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [type, categories, category]);

  // ProperCase diterapkan saat simpan agar keyboard HP tidak terganggu
  const toProperCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());

  const handleSave = async () => {
    if (!amount || !date || !accountId) return;
    if (type === 'transfer' && category === 'Rekening Pribadi' && !targetAccountId) return;
    setSaving(true);
    await onSave({
      ...(isEdit ? { id: tx.id } : {}),
      type, category, accountId,
      amount: verifyNumber(amount),
      note: toProperCase(note),
      date,
      ...(type === 'asset'    && category !== 'Settlement'  ? { isInitial } : {}),
      ...(type === 'transfer' && isPiutangCategory(category) ? { isInitial } : {}),
      ...(type === 'debt'     && category !== 'Pelunasan'   ? { isInitial } : {}),
      ...(type === 'transfer' && category === 'Rekening Pribadi' ? { targetAccountId } : {}),
    });
    setSaving(false);
  };

  const getNotePlaceholder = () => {
    if (type === 'transfer' && isPiutangCategory(category)) return 'Nama peminjam (Cth: Rudi)';
    if (type === 'debt')     return 'Nama pinjaman (Cth: KPR BRI)';
    if (type === 'asset')    return 'Nama aset (Cth: Emas 10g)';
    if (type === 'income')   return 'Sumber (Cth: Gaji Bulanan)';
    if (type === 'expense')  return 'Detail (Cth: Beli Token Listrik)';
    return 'Keterangan';
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4 modal-backdrop-enter">
      <div className="modal-enter w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-2xl"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xl font-outfit font-semibold text-slate-900 dark:text-slate-50">
              {isEdit ? t('tx_edit_title') : t('tx_add_title')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pencatatan Cepat</div>
          </div>
          <button
            type="button" onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* ── Nominal ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold mb-2">
              {t('amount_rp')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-outfit text-emerald-500">Rp</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                className="flex-1 bg-transparent text-4xl font-outfit font-extrabold text-slate-900 dark:text-white outline-none placeholder:text-slate-200 dark:placeholder:text-slate-700 focus:ring-0 p-0"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            {amount && (
              <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {displayIDR(verifyNumber(amount), privacyMode)}
              </div>
            )}
          </div>

          {/* ── Tipe Transaksi ─────────────────────────────────────────── */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Tipe Transaksi
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['expense',  t('tx_expense')],
                ['income',   t('tx_income')],
                ['transfer', t('tx_transfer')],
                ['asset',    t('tx_asset')],
                ['debt',     t('tx_debt')],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setType(v); setIsInitial(false); }}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-all ${
                    type === v
                      ? 'bg-emerald-500 text-white border-transparent shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* ── Asset / Piutang / Utang — Source Selector ──────────────── */}
          {((type === 'asset' && category !== 'Settlement') ||
            (type === 'transfer' && isPiutangCategory(category)) ||
            (type === 'debt' && category !== 'Pelunasan')) && (
            <div className="space-y-2">
              {[
                { val: true,  label: type === 'transfer' ? t('exist_receivable') : type === 'debt' ? t('exist_debt') : t('exist_asset'),
                              desc:  type === 'transfer' ? t('exist_receivable_desc') : type === 'debt' ? t('exist_debt_desc') : t('exist_asset_desc'),
                              color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', radio: 'border-emerald-500 bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
                { val: false, label: type === 'transfer' ? t('new_receivable') : type === 'debt' ? t('new_debt') : t('new_asset'),
                              desc:  type === 'transfer' ? t('new_receivable_desc') : type === 'debt' ? t('new_debt_desc') : t('new_asset_desc'),
                              color: 'border-blue-500 bg-blue-50 dark:bg-blue-500/10', radio: 'border-blue-500 bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
              ].map(({ val, label, desc, color, radio, text }) => (
                <button
                  key={String(val)} type="button"
                  onClick={() => setIsInitial(val)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    isInitial === val ? color : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded-full border-2 ${isInitial === val ? radio : 'border-slate-300 dark:border-slate-600'}`}>
                    {isInitial === val && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${isInitial === val ? text : 'text-slate-900 dark:text-slate-50'}`}>{label}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Fields Grid ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">

            {/* Kategori */}
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{t('category')}</div>
              <select className={FIELD} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-slate-900">{c}</option>)}
              </select>
            </div>

            {/* Tanggal */}
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{t('date')}</div>
              <input type="date" className={FIELD} value={date} onChange={e => setDate(e.target.value)} />
            </div>

            {/* Akun Sumber */}
            <div className="col-span-2">
              <div className="mb-1.5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                {type === 'transfer' ? t('src_account') : t('account')}
              </div>
              <select className={FIELD} value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id} className="bg-white dark:bg-slate-900">{a.name} ({a.type})</option>)}
              </select>
            </div>

            {/* Akun Tujuan */}
            {type === 'transfer' && category === 'Rekening Pribadi' && (
              <div className="col-span-2">
                <div className="mb-1.5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{t('target_account')}</div>
                <select className={FIELD} value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}>
                  <option value="">{t('select_target')}</option>
                  {accounts.filter(a => a.id !== accountId).map(a =>
                    <option key={a.id} value={a.id} className="bg-white dark:bg-slate-900">{a.name} ({a.type})</option>
                  )}
                </select>
              </div>
            )}

            {/* Keterangan */}
            <div className="col-span-2">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">Keterangan</div>
                <span className="text-[10px] rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-medium">Auto ProperCase</span>
              </div>
              <input
                type="text"
                className={`${FIELD} capitalize`}
                placeholder={getNotePlaceholder()}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex gap-3 justify-end px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button" onClick={onClose}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:border-rose-500 hover:text-rose-600 transition"
          >
            {t('cancel')}
          </button>
          <button
            type="button" onClick={handleSave}
            disabled={saving || !amount || !accountId}
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20 text-slate-900 px-6 py-2.5 text-sm font-outfit font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? t('save') : t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
