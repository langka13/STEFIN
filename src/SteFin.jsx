// ─── src/SteFin.jsx ──────────────────────────────────────────────────────────
// SteFin v1.3 — Firebase-integrated | No AI | CSS animations

import { useCallback, useEffect, useState } from 'react'
import {
  Menu, X, PlusCircle, Wallet,
  Settings, LayoutDashboard,
  Clock3, LogOut, Sun, Moon,
} from 'lucide-react'

import { useAuth } from './hooks/useAuth'
import { useFirebase } from './hooks/useFirebase'
import { useFirebaseStorage } from './hooks/useFirebaseStorage'
import { useLanguage } from './contexts/LanguageContext.jsx'
import { SplashScreen } from './components/SplashScreen.jsx'
import { LoginScreen } from './components/LoginScreen.jsx'
import { OnboardingScreen } from './components/OnboardingScreen.jsx'
import { DashboardPage } from './components/DashboardPage.jsx'
import { FinancialStatementPage } from './components/FinancialStatementPage.jsx'
import { AccountsPage } from './components/AccountsPage.jsx'
import { SettingsPage } from './components/SettingsPage.jsx'
import { TransactionModal } from './components/TransactionModal.jsx'
import { AccountModal } from './components/AccountModal.jsx'
import AssetsPage from './AssetsPage.jsx'
import { PinScreen } from './components/PinScreen.jsx'
import { AppLogo } from './components/AppLogo.jsx'

import {
  CURRENT_MONTH,
  formatIDR,
  getMonthKey,
  monthLabel,
} from './utils/constants.js'

import { FinancialProvider } from './contexts/FinancialContext.jsx'

// ─── Root component ───────────────────────────────────────────────────────────
export default function SteFin() {
  const { lang, t, privacyMode, togglePrivacyMode } = useLanguage()

  // Auth
  const { user, authLoading, authError, setAuthError, registerWithEmail, loginWithEmail, loginWithGoogle, logout, updateUserProfile, resetPassword } = useAuth()

  // Firestore
  const {
    transactions, accounts, profile, dbLoading,
    saveProfile,
    addTransaction, updateTransaction, deleteTransaction,
    addAccount, updateAccount, deleteAccount,
  } = useFirebase(user?.uid)

  // Onboarding storage
  const { hasOnboarded, completeOnboarding, preferences, savePreferences } = useFirebaseStorage(saveProfile, profile)

  // Security state
  const [isUnlocked, setIsUnlocked] = useState(false)
  const appPin = preferences?.appPin
  
  const localBiometricKey = user ? `stefin_biometric_${user.uid}` : 'stefin_biometric';
  const biometricCredentialId = typeof window !== 'undefined' ? localStorage.getItem(localBiometricKey) : null;
  const biometricEnabled = !!biometricCredentialId;

  // Stabil referensi — tidak berubah tiap render, mencegah re-fire di PinScreen
  const handleUnlock = useCallback(() => setIsUnlocked(true), [])

  // UI state
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [activeTx, setActiveTx] = useState(null)
  const [toast, setToast] = useState(null)
  const [toastVisible, setToastVisible] = useState(false)

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [onboardStep, setOnboardStep] = useState(0)
  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH)

  const [installPromptEvent, setInstallPromptEvent] = useState(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPromptEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleInstallApp = async () => {
    if (!installPromptEvent) return
    installPromptEvent.prompt()
    const { outcome } = await installPromptEvent.userChoice
    if (outcome === 'accepted') {
      setInstallPromptEvent(null)
    }
  }

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const handleNavigate = () => { setPage('dashboard') }
    const handleAddAccount = () => { setModal('add-account') }
    const handleNavigateAccounts = () => { setPage('accounts') }
    const handleAddTxWithDraft = (e) => { setActiveTx(e.detail); setModal('add-transaction') }

    window.addEventListener('stefin_navigate_smart_entry', handleNavigate)
    window.addEventListener('stefin_navigate_add_account', handleAddAccount)
    window.addEventListener('stefin_navigate_accounts', handleNavigateAccounts)
    window.addEventListener('stefin_navigate_add_transaction_with_draft', handleAddTxWithDraft)
    return () => {
      window.removeEventListener('stefin_navigate_smart_entry', handleNavigate)
      window.removeEventListener('stefin_navigate_add_account', handleAddAccount)
      window.removeEventListener('stefin_navigate_accounts', handleNavigateAccounts)
      window.removeEventListener('stefin_navigate_add_transaction_with_draft', handleAddTxWithDraft)
    }
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setToastVisible(true)
    clearTimeout(window.__stefin_toast)
    window.__stefin_toast = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setToast(null), 250)
    }, 3200)
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOnboardDone = async (userName) => {
    await completeOnboarding(userName || user?.name || 'Pengguna')
    setPage('dashboard')
    showToast(t('toast_onboarding_done', 'Onboarding selesai. Selamat datang di SteFin! 🎉'))
  }

  const handleAddTransaction = async (tx) => {
    await addTransaction(tx)
    showToast(t('toast_tx_added', 'Transaksi berhasil ditambahkan.'))
    setModal(null)
  }

  const handleUpdateTransaction = async (tx) => {
    await updateTransaction(tx)
    showToast(t('toast_tx_updated', 'Transaksi diperbarui.'))
    setModal(null)
    setActiveTx(null)
  }

  const handleDeleteTransaction = async (id) => {
    await deleteTransaction(id)
    showToast(t('toast_tx_deleted', 'Transaksi dihapus.'))
  }

  const handleAddAccount = async (acc) => {
    await addAccount(acc)
    showToast(t('toast_acc_added', 'Akun sumber dana ditambahkan.'))
    setModal(null)
  }

  const handleUpdateAccount = async (acc) => {
    await updateAccount(acc)
    showToast(t('toast_acc_updated', 'Akun diperbarui.'))
  }

  const handleDeleteAccount = async (id) => {
    await deleteAccount(id)
    showToast(t('toast_acc_deleted', 'Akun dihapus.'))
    setModal(null)
  }

  const handleExportReport = async (requestedMonth) => {
    if (!user) return
    const targetMonth = requestedMonth || filterMonth
    showToast(t('toast_report_prep', 'Sedang menyiapkan laporan...'))
    try {
      const label = monthLabel(targetMonth)
      const res = await fetch('/api/export-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          userName: user.name || 'Pengguna SteFin',
          targetMonth,
          targetMonthLabel: label
        })
      })
      if (res.ok) {
        showToast(t('toast_report_sent', 'Laporan telah dikirim ke email Anda! 📧'))
      } else {
        throw new Error('Gagal mengirim email')
      }
    } catch (e) {
      console.error(e)
      showToast(t('toast_report_failed', 'Gagal mengirim laporan. Pastikan koneksi aman.'))
    }
  }

  const handleLogout = async () => {
    await logout()
    if (appPin) {
      await savePreferences({ ...preferences, appPin: null })
      localStorage.removeItem(localBiometricKey)
    }
    setPage('dashboard')
    setModal(null)
  }

  // ── Render guards ────────────────────────────────────────────────────────────
  if (authLoading) return <SplashScreen label={t('loading_stefin')} />

  if (!user) return (
    <LoginScreen
      authError={authError}
      setAuthError={setAuthError}
      onEmail={async (name, email, password, isRegister) => {
        const res = isRegister
          ? await registerWithEmail(name, email, password)
          : await loginWithEmail(email, password)
        if (!res.success) showToast(res.error)
      }}
      onGoogle={async () => {
        const res = await loginWithGoogle()
        if (!res.success) showToast(res.error)
      }}
      onResetPassword={resetPassword}
    />
  )

  if (dbLoading) return <SplashScreen label={t('loading_data')} />

  if (!hasOnboarded) return (
    <OnboardingScreen
      user={user}
      accounts={accounts}
      step={onboardStep}
      setStep={setOnboardStep}
      onAddAccount={handleAddAccount}
      onDone={handleOnboardDone}
    />
  )

  if (appPin && !isUnlocked) {
    return (
      <PinScreen
        savedPin={appPin}
        isBiometricEnabled={biometricEnabled}
        biometricCredentialId={biometricCredentialId}
        onUnlock={handleUnlock}
        onReset={handleLogout}
      />
    )
  }

  // ── NAV TABS config ──────────────────────────────────────────────────────────
  const NAV_TABS = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'history',   label: t('nav.statement'), icon: Clock3 },
    { id: 'assets',    label: t('nav.assets'),    icon: Wallet },
    { id: 'settings',  label: t('nav.settings'),  icon: Settings },
  ]

  // 5. Main app
  return (
    <FinancialProvider transactions={transactions} accounts={accounts} preferences={preferences} addTransaction={handleAddTransaction}>
      <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="hidden lg:inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors hover:border-emerald-400 dark:hover:border-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-400"
                onClick={() => setSidebarOpen(s => !s)}
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <AppLogo className="w-10 h-10 shadow-sm" />
              <div>
                <div className="text-2xl font-outfit font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-none">SteFin</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-1">
                  {(() => {
                    const h = new Date().getHours()
                    if (h >= 5 && h < 11) return `${t('greeting.morning')} 🌅`
                    if (h >= 11 && h < 15) return `${t('greeting.afternoon')} ☀️`
                    if (h >= 15 && h < 18) return `${t('greeting.evening')} 🌤️`
                    return `${t('greeting.night')} 🌙`
                  })()}, <span className="font-semibold text-slate-700 dark:text-slate-300">{user.name || 'Pengguna'}</span>!
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => setModal('add-transaction')}
                className="hidden lg:flex items-center gap-2 rounded-2xl bg-brand-lime hover:opacity-90 active:scale-95 px-4 py-2 text-sm font-semibold text-slate-900 transition-all shadow-sm"
              >
                <PlusCircle className="h-4 w-4" />
                Tambah Transaksi
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Live sync indicator */}
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 sm:flex">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Firebase Sync
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 py-2 text-sm text-slate-600 dark:text-slate-300 transition-colors hover:border-rose-500 hover:text-rose-600"
              >
                <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t('sign_out')}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Sidebar overlay (desktop) ────────────────────────────────────── */}
        {sidebarOpen && (
          <>
            <div
              className="sidebar-overlay fixed inset-0 z-40 bg-slate-900/40 dark:bg-slate-950/60"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="sidebar-panel fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl hidden lg:block">
              <div className="mb-8 flex items-center justify-between">
                <div className="text-lg font-outfit font-semibold text-slate-900 dark:text-slate-50">{t('main_menu') || 'Menu Utama'}</div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {NAV_TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id} type="button"
                    onClick={() => { setPage(id); setSidebarOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                      page === id
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${page === id ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                    {label}
                  </button>
                ))}
              </nav>

              {/* User card */}
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white text-lg font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{user.name}</div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* ── Page content ────────────────────────────────────────────────── */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-28 lg:pb-8">
          {page === 'dashboard' && (
            <DashboardPage
              theme={theme}
              user={user}
              onEdit={tx => { setActiveTx(tx); setModal('edit-transaction') }}
              onDelete={handleDeleteTransaction}
            />
          )}
          {page === 'history' && (
            <FinancialStatementPage
              onEdit={tx => { setActiveTx(tx); setModal('edit-transaction') }}
              onDelete={handleDeleteTransaction}
            />
          )}
          {page === 'accounts' && (
            <AccountsPage
              onAdd={() => setModal('add-account')}
              onUpdate={handleUpdateAccount}
              onDelete={handleDeleteAccount}
              onAdjust={acc => { setActiveTx(acc); setModal('adjust-account') }}
            />
          )}
          {page === 'assets' && (
            <AssetsPage
              onEdit={tx => { setActiveTx(tx); setModal('edit-transaction') }}
              onDelete={handleDeleteTransaction}
              onAdd={(defaultTx) => { setActiveTx(defaultTx || null); setModal('add-transaction') }}
              onSaveTransaction={handleAddTransaction}
              onUpdateTransaction={async (id, fields) => {
                await updateTransaction({ id, ...fields })
                showToast(t('toast_receivable_paid', 'Piutang ditandai lunas.'))
              }}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              user={user}
              onExportReport={handleExportReport}
              onLogout={handleLogout}
              theme={theme}
              onThemeChange={setTheme}
              showToast={showToast}
              updateUserProfile={updateUserProfile}
              resetPassword={resetPassword}
              onNavigateToAccounts={() => setPage('accounts')}
              preferences={preferences}
              savePreferences={savePreferences}
              installPromptEvent={installPromptEvent}
              onInstallApp={handleInstallApp}
            />
          )}
        </main>

        {/* ── Bottom Tab Bar (Mobile Only) — Opsi B: FAB elevated ──────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm pb-safe">
          {/* FAB elevated — melayang di atas navbar */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-50">
            <button
              onClick={() => setModal('add-transaction')}
              aria-label="Tambah Transaksi"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-lime text-slate-900 shadow-lg shadow-brand-lime/40 active:scale-90 transition-transform border-4 border-white dark:border-slate-950"
            >
              <PlusCircle className="h-6 w-6" />
            </button>
          </div>

          {/* Tab row — 4 tab tersebar, tengah dikosongkan untuk FAB */}
          <div className="flex items-end px-2 pt-1 pb-2">
            {/* Tab kiri: Dashboard & History */}
            <div className="flex flex-1 justify-around">
              {NAV_TABS.slice(0, 2).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className="group flex flex-col items-center gap-1 px-3 py-1.5 touch-manipulation min-w-[56px]"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                    page === id
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-medium leading-none transition-colors ${
                    page === id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {label}
                  </span>
                  {page === id && (
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Spacer untuk FAB di tengah */}
            <div className="w-16 flex-shrink-0" />

            {/* Tab kanan: Assets & Settings */}
            <div className="flex flex-1 justify-around">
              {NAV_TABS.slice(2, 4).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPage(id)}
                  className="group flex flex-col items-center gap-1 px-3 py-1.5 touch-manipulation min-w-[56px]"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                    page === id
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] font-medium leading-none transition-colors ${
                    page === id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {label}
                  </span>
                  {page === id && (
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* ── Modals ──────────────────────────────────────────────────────── */}
        {modal === 'add-transaction' && (
          <TransactionModal
            tx={activeTx}
            accounts={accounts}
            onClose={() => { setModal(null); setActiveTx(null) }}
            onSave={handleAddTransaction}
          />
        )}
        {modal === 'edit-transaction' && activeTx && (
          <TransactionModal
            tx={activeTx}
            accounts={accounts}
            onClose={() => { setModal(null); setActiveTx(null) }}
            onSave={handleUpdateTransaction}
          />
        )}
        {modal === 'add-account' && (
          <AccountModal
            onClose={() => setModal(null)}
            onSave={handleAddAccount}
          />
        )}
        {modal === 'adjust-account' && activeTx && (
          <AccountModal
            account={activeTx}
            onClose={() => { setModal(null); setActiveTx(null) }}
            onSave={handleUpdateAccount}
          />
        )}

        {/* ── Toast (CSS only) ─────────────────────────────────────────────── */}
        {toast && (
          <div
            className={`fixed right-4 bottom-24 lg:bottom-6 z-50 max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 shadow-lg transition-all duration-200 ${
              toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {toast}
          </div>
        )}
      </div>
    </FinancialProvider>
  )
}
