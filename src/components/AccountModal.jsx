import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { formatIDR, displayIDR, verifyNumber, ACCOUNT_NAMES } from '../utils/constants.js';

export function AccountModal({ account, onClose, onSave }) {
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 dark:bg-slate-950/60 p-4 modal-backdrop-enter">
      <div className="modal-enter w-full max-w-md max-h-[85vh] overflow-y-auto overscroll-contain rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-2xl p-4 sm:p-5 lg:p-6"
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
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-brand-lime" value={type} onChange={e => handleTypeChange(e.target.value)}>
              <option value="Bank">{t('acc_type_bank')}</option>
              <option value="Cash">{t('acc_type_cash')}</option>
              <option value="E-Wallet">{t('acc_type_ewallet')}</option>
            </select>
          </div>
          {/* Step 2: Nama Akun (cascading dari tipe) */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('acc_name_placeholder') || 'Nama Akun'}</div>
            <select className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-brand-lime" value={nameChoice} onChange={e => setNameChoice(e.target.value)}>
              <option value="">— Pilih nama akun —</option>
              {nameOptions.map(n => <option key={n} value={n} className="bg-white dark:bg-slate-900">{n}</option>)}
            </select>
          </div>
          {/* Step 3: Custom name jika pilih Lainnya */}
          {nameChoice === 'Lainnya' && (
            <input
              className="w-full rounded-2xl border border-brand-lime bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-brand-lime placeholder:text-slate-400"
              placeholder="Masukkan nama akun..."
              value={customName}
              onChange={e => setCustomName(e.target.value)}
            />
          )}
          {/* Saldo */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('init_balance')}</div>
            <input type="number" className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-brand-lime placeholder:text-slate-600" placeholder="0" value={balance} onChange={e => setBalance(e.target.value)} />
            {balance && <div className="mt-1 text-xs text-brand-lime">{displayIDR(verifyNumber(balance), privacyMode)}</div>}
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-3 text-sm text-slate-600 dark:text-slate-300 hover:border-brand-lime transition">{t('cancel')}</button>
          <button type="button" onClick={handleSave} disabled={saving || !resolvedName} className="flex items-center gap-2 rounded-2xl bg-brand-lime shadow-lg shadow-brand-lime/20 text-slate-900 px-6 py-3 text-sm font-outfit font-semibold hover:opacity-90 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('save_acc')}
          </button>
        </div>
      </div>
    </div>
  )
}
