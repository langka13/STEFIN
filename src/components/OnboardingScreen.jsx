import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_NAMES, verifyNumber, formatIDR, displayIDR } from '../utils/constants.js';

import { AppLogo } from './AppLogo.jsx';

export function OnboardingScreen({ user, accounts, step, setStep, onAddAccount, onDone }) {
  const { t, privacyMode } = useLanguage();
  const [newAcc, setNewAcc] = useState({ name: '', type: 'Bank', balance: '', icon: '🏦' })
  const [saving, setSaving] = useState(false)
  const ICONS = { Bank: '🏦', Cash: '💵', 'E-Wallet': '💳' }

  const handleAdd = async () => {
    if (!newAcc.name || !newAcc.balance) return
    await onAddAccount({ name: newAcc.name, type: newAcc.type, balance: verifyNumber(newAcc.balance), icon: ICONS[newAcc.type] })
    setNewAcc({ name: '', type: 'Bank', balance: '', icon: '🏦' })
  }

  const handleDone = async () => {
    setSaving(true)
    await onDone(user.name)
    setSaving(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-900 px-4 py-10 text-slate-900 dark:text-slate-50">
      <div className="w-full max-w-4xl space-y-6 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-outfit font-semibold">{t('welcome_name')}, {user.name} 👋</div>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{t('onboard_welcome_desc')}</p>
          </div>
          {/* Step dots */}
          <div className="flex gap-2">
            {[0, 1].map(i => (
              <div key={i} className={`h-2 w-2 rounded-full transition ${i === step ? 'bg-emerald-400 w-6' : i < step ? 'bg-emerald-700' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left panel */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md p-4 sm:p-5 lg:p-6">
            <div className="mb-4 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('step_of', { step: step + 1, total: 2 })}</div>

            {step === 0 ? (
              <div className="space-y-4">
                <div className="text-xl font-outfit font-semibold">{t('basic_profile')}</div>
                <input className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" placeholder={t('fullname')} defaultValue={user.name} />
                <input className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-4 py-3 text-slate-500 dark:text-slate-400 outline-none" value={user.email} disabled />
                <button type="button" onClick={() => setStep(1)} className="rounded-2xl bg-brand-lime shadow-lg shadow-brand-lime/20 text-slate-900 px-6 py-3 font-outfit font-semibold transition hover:opacity-90">
                  {t('continue_btn')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xl font-outfit font-semibold">{t('register_accs')}</div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('register_accs_desc')}</p>

                {/* Existing accounts */}
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{acc.icon}</span>
                        <div>
                          <div className="text-sm font-outfit font-semibold">{acc.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{acc.type}</div>
                        </div>
                      </div>
                      <div className="text-sm font-outfit font-semibold text-emerald-400">{displayIDR(acc.balance, privacyMode)}</div>
                    </div>
                  ))}
                </div>

                {/* Add account form */}
                <div className="rounded-2xl border border-dashed border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-2">
                  <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">+ {t('add_account')}</div>
                  {/* Tipe Akun */}
                  <select className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={newAcc.type} onChange={e => setNewAcc({ name: '', type: e.target.value, balance: newAcc.balance, icon: ICONS[e.target.value] })}>
                    <option value="Bank">{t('acc_type_bank')}</option>
                    <option value="Cash">{t('acc_type_cash')}</option>
                    <option value="E-Wallet">{t('acc_type_ewallet')}</option>
                  </select>
                  {/* Nama Akun — cascading */}
                  <select className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" value={newAcc.name} onChange={e => setNewAcc(p => ({ ...p, name: e.target.value }))}>
                    <option value="">{t('select_account_name', '— Pilih nama akun —')}</option>
                    {(ACCOUNT_NAMES[newAcc.type] || []).map(n => <option key={n} value={n} className="bg-white dark:bg-slate-900">{n}</option>)}
                  </select>
                  {/* Custom name jika Lainnya */}
                  {newAcc.name === 'Lainnya' && (
                    <input className="w-full rounded-xl border border-emerald-400 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" placeholder={t('other_account_name', 'Nama akun...')} onChange={e => setNewAcc(p => ({ ...p, name: e.target.value }))} />
                  )}
                  {/* Saldo + Tambah */}
                  <div className="flex gap-2">
                    <input className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-md px-3 py-2 text-sm text-slate-900 dark:text-slate-50 outline-none focus:border-emerald-500" type="number" placeholder={t('init_balance')} value={newAcc.balance} onChange={e => setNewAcc(p => ({ ...p, balance: e.target.value }))} />
                    <button type="button" onClick={handleAdd} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-50 hover:bg-slate-200 dark:hover:bg-slate-700">{t('add')}</button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(0)} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm text-slate-600 dark:text-slate-300 hover:border-emerald-500">{t('back_btn')}</button>
                  <button type="button" onClick={handleDone} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-lime shadow-lg shadow-brand-lime/20 text-slate-900 px-5 py-3 text-sm font-outfit font-semibold hover:opacity-90 disabled:opacity-60">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('start_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden flex-col items-center justify-center rounded-3xl bg-brand-lime/10 p-8 lg:flex">
            <AppLogo className="w-24 h-24 mb-6" />
            <div className="text-center font-outfit text-2xl font-semibold text-slate-900 dark:text-slate-50">{t('start_journey')}</div>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{t('onboard_tips')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
