import { memo, useState, useEffect } from 'react';
import { 
  Globe, Sparkles, User, FileText, 
  ChevronRight, LogOut, ChevronLeft,
  Palette, HelpCircle, MessageSquare, Info, Shield, Mail,
  X, Moon, Sun, Wallet, Tag, DollarSign, Lock, Fingerprint,
  Check, AlertTriangle, ExternalLink, ChevronDown, Smartphone
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { displayIDR, getCategoryOptions, TAXONOMY, MONTHS_FULL, CURRENT_MONTH } from '../utils/constants.js';
import { useFinancial } from '../contexts/FinancialContext.jsx';
import { isBiometricAvailable, registerBiometric } from '../utils/biometrics.js';


const currentAccent = { from: '#10b981', to: '#14b8a6', ring: '#10b981', label: 'Emerald' };

const CURRENCIES = [
  { code: 'IDR', symbol: 'Rp', label: 'Rupiah Indonesia (IDR)' },
  { code: 'USD', symbol: '$',  label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€',  label: 'Euro (EUR)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (SGD)' },
  { code: 'MYR', symbol: 'RM', label: 'Ringgit Malaysia (MYR)' },
  { code: 'JPY', symbol: '¥',  label: 'Japanese Yen (JPY)' },
];

// ── Reusable Components ──────────────────────────────────────────────────────
const SettingGroup = ({ title, children }) => (
  <div className="mb-6">
    {title && <h3 className="text-xs font-outfit font-semibold text-slate-500 dark:text-slate-400 mb-3 px-1 tracking-wider uppercase">{title}</h3>}
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60">
      {children}
    </div>
  </div>
);

const SettingRow = ({ icon: Icon, title, subtitle, action, onClick, isDestructive, iconBg }) => (
  <div 
    className={`flex items-center justify-between p-4 ${onClick ? 'cursor-pointer active:bg-slate-100 dark:active:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className="flex gap-3.5 items-center min-w-0">
      <div className={`p-2 rounded-xl flex-shrink-0 ${
        isDestructive 
          ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' 
          : iconBg || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
      }`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${isDestructive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>{title}</div>
        {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</div>}
      </div>
    </div>
    <div className="flex-shrink-0 ml-2">{action || (onClick && <ChevronRight size={18} className="text-slate-400" />)}</div>
  </div>
);

// ── Modal Wrapper ────────────────────────────────────────────────────────────
const ModalSheet = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop-enter">
    <div
      className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60"
      onClick={onClose}
    />
    <div
      className="modal-sheet-enter relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 flex-shrink-0">
        <div className="font-outfit font-semibold text-lg text-slate-900 dark:text-slate-100">{title}</div>
        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <X size={20} />
        </button>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      {/* Footer */}
      {footer && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 flex-shrink-0">{footer}</div>
      )}
    </div>
  </div>
);

// ── Export Report Helpers ─────────────────────────────────────────────────────
const getPastMonths = () => {
  const result = [];
  const [cy, cm] = CURRENT_MONTH.split('-').map(Number);
  for(let i=0; i<12; i++) {
    let y = cy, m = cm - i;
    if (m <= 0) { m += 12; y -= 1; }
    const val = `${y}-${String(m).padStart(2,'0')}`;
    const label = `${MONTHS_FULL[m-1]} ${y}`;
    result.push({ value: val, label });
  }
  return result;
};
const PAST_MONTHS = getPastMonths();

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export const SettingsPage = memo(function SettingsPage({ 
  user, onExportReport, onLogout, theme, onThemeChange, showToast, 
  updateUserProfile, resetPassword, onNavigateToAccounts, preferences, savePreferences,
  installPromptEvent, onInstallApp
}) {
  const { lang, changeLang, t } = useLanguage();
  const [modal, setModal] = useState(null);
  const [editName, setEditName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  
  // Custom categories state
  const [newCat, setNewCat] = useState({ type: 'income', value: '' });

  // PIN setup state
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [isBiometrySupported, setIsBiometrySupported] = useState(false);
  
  const customCategories = preferences?.customCategories || {};
  const hasPin = !!preferences?.appPin;
  
  // Ambil credential id dari local storage
  const localBiometricKey = user ? `stefin_biometric_${user.uid}` : 'stefin_biometric';
  const [isBiometricEnabled, setBiometricEnabled] = useState(() => {
    return typeof window !== 'undefined' ? !!localStorage.getItem(localBiometricKey) : false;
  });

  useEffect(() => {
    isBiometricAvailable().then(avail => setIsBiometrySupported(avail));
  }, []);

  // Currency
  const currency = typeof window !== 'undefined' ? (localStorage.getItem('stefin_currency') || 'IDR') : 'IDR';
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);

  // Apply visual CSS vars
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-from', currentAccent.from);
    document.documentElement.style.setProperty('--accent-to', currentAccent.to);
    document.documentElement.style.setProperty('--accent-ring', currentAccent.ring);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editName.trim()) return showToast(t('toast_name_empty', 'Nama tidak boleh kosong'));
    setIsSaving(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile(editName);
        showToast(t('toast_profile_saved', 'Profil berhasil diperbarui.'));
      } else {
        showToast('Fitur edit profil tidak tersedia saat ini.');
      }
      setModal(null);
    } catch { showToast(t('toast_profile_failed', 'Gagal menyimpan profil.')); }
    finally { setIsSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return showToast(t('toast_email_not_found', 'Tidak dapat menemukan email.'));
    setIsSaving(true);
    try {
      if (resetPassword) {
        const res = await resetPassword(user.email);
        if (res.success) showToast(t('toast_reset_sent', 'Email reset password berhasil dikirim.'));
        else showToast(res.error || t('toast_reset_failed', 'Gagal mengirim email reset password.'));
      } else {
        showToast('Fitur reset kata sandi tidak tersedia saat ini.');
      }
      setModal(null);
    } catch { showToast('Gagal memproses permintaan.'); }
    finally { setIsSaving(false); }
  };

  const handleAddCustomCategory = async (type) => {
    if (!newCat.value.trim()) return;
    const currentList = customCategories[type] || [];
    if (currentList.includes(newCat.value.trim())) {
      showToast(t('toast_cat_exist', 'Kategori sudah ada.'));
      return;
    }
    const updated = {
      ...customCategories,
      [type]: [...currentList, newCat.value.trim()]
    };
    setIsSaving(true);
    try {
      await savePreferences({ ...preferences, customCategories: updated });
      setNewCat({ type, value: '' });
      showToast(t('toast_cat_added', 'Kategori kustom ditambahkan.'));
    } catch (e) {
      showToast(t('toast_cat_failed_save', 'Gagal menyimpan kategori.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomCategory = async (type, categoryValue) => {
    const currentList = customCategories[type] || [];
    const updated = {
      ...customCategories,
      [type]: currentList.filter(c => c !== categoryValue)
    };
    try {
      await savePreferences({ ...preferences, customCategories: updated });
      showToast(t('toast_cat_deleted', 'Kategori dihapus.'));
    } catch (e) {
      showToast(t('toast_cat_failed_delete', 'Gagal menghapus kategori.'));
    }
  };

  const handleSetPin = async () => {
    if (pinDraft.length !== 6) return showToast(t('toast_pin_6_digit', 'PIN harus 6 digit.'));
    if (pinDraft !== pinConfirm) return showToast(t('toast_pin_mismatch', 'Konfirmasi PIN tidak cocok.'));
    
    setIsSaving(true);
    try {
      await savePreferences({ ...preferences, appPin: pinDraft });
      showToast(t('toast_pin_enabled', 'PIN berhasil diaktifkan.'));
      setIsSettingPin(false);
      setPinDraft('');
      setPinConfirm('');
    } catch (e) {
      showToast(t('toast_pin_failed', 'Gagal menyimpan PIN.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetupBiometrics = async () => {
    setIsSaving(true);
    try {
      if (isBiometricEnabled) {
        localStorage.removeItem(localBiometricKey);
        setBiometricEnabled(false);
        showToast('Autentikasi biometrik dinonaktifkan.');
      } else {
        const credentialId = await registerBiometric(user?.email || 'User');
        if (credentialId) {
          localStorage.setItem(localBiometricKey, credentialId);
          setBiometricEnabled(true);
          showToast('Autentikasi biometrik berhasil diaktifkan.');
        }
      }
    } catch (e) {
      showToast('Gagal memproses biometrik. Pastikan perangkat mendukung.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <section className="max-w-2xl mx-auto space-y-2 pb-24">
      {/* ── Profile Card ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 mb-8">
        <div className="flex items-center gap-4">
          <div 
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl shadow-lg text-white text-2xl font-bold uppercase"
            style={{ background: `linear-gradient(135deg, ${currentAccent.from}, ${currentAccent.to})`, boxShadow: `0 8px 24px ${currentAccent.from}33` }}
          >
            {user?.name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-outfit font-semibold text-slate-900 dark:text-white capitalize truncate">{user?.name}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email}</div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Shield size={12} /> {t('settings_verified')}
            </div>
          </div>
        </div>
      </div>

      {/* ── 1. Pengaturan Akun ─────────────────────────────────────────────── */}
      <SettingGroup title={t('settings_account')}>
        <SettingRow 
          icon={User} 
          title={t('settings_profile')} 
          subtitle={t('settings_profile_sub')}
          iconBg="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
          onClick={() => { setEditName(user?.name || ''); setModal('profile'); }} 
        />
        <SettingRow 
          icon={Shield} 
          title={t('settings_security')} 
          subtitle={t('settings_security_sub')}
          iconBg="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"
          onClick={() => setModal('security')} 
        />
      </SettingGroup>

      {/* ── 2. Kelola Data ─────────────────────────────────────────────────── */}
      <SettingGroup title={t('settings_data')}>
        <SettingRow 
          icon={Wallet} 
          title={t('settings_source')} 
          subtitle={t('settings_source_sub')}
          iconBg="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          onClick={() => onNavigateToAccounts?.()} 
        />
        <SettingRow 
          icon={Tag} 
          title={t('settings_category')} 
          subtitle={t('settings_category_sub')}
          iconBg="bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400"
          onClick={() => setModal('categories')} 
        />
      </SettingGroup>

      {/* ── 3. Personalisasi ───────────────────────────────────────────────── */}
      <SettingGroup title={t('settings_personalization')}>
        <SettingRow 
          icon={Palette} 
          title={t('settings_appearance')} 
          subtitle={theme === 'dark' ? t('settings_dark_mode') : t('settings_light_mode')}
          iconBg="bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400"
          onClick={() => setModal('appearance')} 
        />
        <SettingRow 
          icon={Globe} 
          title={t('lang_pref')} 
          subtitle={lang === 'id' ? 'Bahasa Indonesia' : 'English'}
          iconBg="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400"
          onClick={() => setModal('language')}
        />
        <SettingRow 
          icon={DollarSign} 
          title={t('settings_currency')} 
          subtitle={CURRENCIES.find(c => c.code === currency)?.label || 'IDR'}
          iconBg="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
          onClick={() => setModal('currency')} 
        />
      </SettingGroup>

      {/* ── 5. Informasi & Bantuan ─────────────────────────────────────────── */}
      <SettingGroup title={t('settings_help')}>
        {(!isStandalone || installPromptEvent) && (
          <SettingRow 
            icon={Smartphone} 
            title="Pemasangan Aplikasi (PWA)" 
            subtitle={isStandalone ? "Aplikasi sudah terpasang" : "Instal SteFin ke layar utama perangkat"}
            iconBg="bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"
            onClick={installPromptEvent ? onInstallApp : () => setModal('pwa_help')}
            action={
              installPromptEvent ? (
                <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white shadow-sm hover:opacity-90">
                  Instal
                </button>
              ) : null
            }
          />
        )}
        <SettingRow 
          icon={Info} 
          title={t('settings_privacy')} 
          subtitle={t('settings_privacy_sub')}
          iconBg="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
          onClick={() => setModal('privacy')} 
        />
        <SettingRow 
          icon={HelpCircle} 
          title={t('settings_support')} 
          subtitle={t('settings_support_sub')}
          iconBg="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          onClick={() => setModal('help')} 
        />
        <a href="mailto:contact@langka13.com?subject=Feedback SteFin App">
          <SettingRow 
            icon={MessageSquare} 
            title={t('settings_feedback')} 
            subtitle={t('settings_feedback_sub')}
            iconBg="bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
          />
        </a>
      </SettingGroup>

      {/* ── 6. Keluar ──────────────────────────────────────────────────────── */}
      <SettingGroup>
        <SettingRow 
          icon={LogOut} 
          title={t('sign_out')} 
          subtitle={t('settings_signout_sub')}
          onClick={onLogout}
          isDestructive={true}
        />
      </SettingGroup>

      {/* Footer */}
      <div className="pt-6 pb-12 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="mb-1 text-sm font-outfit font-bold text-slate-900 dark:text-slate-100 tracking-wide">STEFIN SMART TECH FINANCIAL</div>
        <div className="mb-3 font-medium text-emerald-600 dark:text-emerald-400">Kontrol Langkah Finansial</div>
        <p>Development by <a href="https://boarc.vercel.app" target="_blank" rel="noreferrer" className="font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-500 transition-colors">Boarc Studio</a></p>
        <p className="mt-1 text-slate-400 dark:text-slate-500">v2.0.0</p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODALS                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <div>

        {/* ── Profile Modal ─────────────────────────────────────────────── */}
        {modal === 'profile' && (
          <ModalSheet title={t('settings_profile')} onClose={() => setModal(null)}
            footer={
              <div className="flex justify-end gap-3">
                <button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">{t('cancel', 'Batal')}</button>
                <button onClick={handleSaveProfile} disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl font-medium text-slate-900 bg-emerald-500 shadow-lg shadow-emerald-500/20 hover:opacity-90 disabled:opacity-50 transition"
                >{isSaving ? <Loader2 className="animate-spin" size={18}/> : t('save', 'Simpan')}</button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('display_name')}</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                  placeholder={t('display_name')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{t('email_address')}</label>
                <input type="email" value={user?.email || ''} disabled
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 p-3 text-slate-500 dark:text-slate-500 outline-none cursor-not-allowed"
                />
              </div>
            </div>
          </ModalSheet>
        )}

        {/* ── Security Modal ────────────────────────────────────────────── */}
        {modal === 'security' && (
          <ModalSheet title="Keamanan" onClose={() => setModal(null)}>
            <div className="space-y-5">
              {/* Reset Password */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                    <Mail size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ubah Kata Sandi</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Kirim email reset ke {user?.email}</div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Kami akan mengirim tautan untuk mengatur ulang kata sandi Anda. Anda perlu masuk kembali setelah mengubahnya.
                </p>
                <button onClick={handleResetPassword} disabled={isSaving}
                  className="w-full py-2.5 rounded-xl font-medium text-sm text-white bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20 disabled:opacity-50 transition"
                >{isSaving ? 'Mengirim...' : 'Kirim Email Reset Password'}</button>
              </div>

              {/* PIN */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Lock size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">PIN Aplikasi</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Kunci akses cepat ke aplikasi</div>
                  </div>
                </div>
                
                {!isSettingPin ? (
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Status: {hasPin ? 'Aktif' : 'Tidak Aktif'}</span>
                    <button 
                      onClick={() => {
                        if (hasPin) {
                          savePreferences({ ...preferences, appPin: null, biometricEnabled: false });
                          showToast(t('toast_pin_disabled', 'PIN dinonaktifkan.'));
                        } else {
                          setIsSettingPin(true);
                        }
                      }}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${hasPin ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}
                    >
                      {hasPin ? 'Matikan PIN' : 'Buat PIN'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <input 
                      type="password" 
                      maxLength="6"
                      placeholder="Masukkan 6 digit PIN" 
                      value={pinDraft}
                      onChange={e => setPinDraft(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-center tracking-[0.5em] text-slate-900 dark:text-white outline-none"
                    />
                    <input 
                      type="password" 
                      maxLength="6"
                      placeholder="Konfirmasi PIN" 
                      value={pinConfirm}
                      onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-center tracking-[0.5em] text-slate-900 dark:text-white outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setIsSettingPin(false)} className="flex-1 py-2 rounded-xl text-slate-500 bg-slate-200 dark:bg-slate-700 font-medium text-sm">Batal</button>
                      <button onClick={handleSetPin} disabled={isSaving} className="flex-1 py-2 rounded-xl text-white bg-emerald-500 hover:bg-emerald-600 font-medium text-sm transition">Simpan</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Biometrics */}
              {isBiometrySupported && hasPin && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                      <Fingerprint size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Buka Kunci Biometrik</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Gunakan sidik jari atau Face ID</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Status: {isBiometricEnabled ? 'Aktif' : 'Tidak Aktif'}</span>
                    <button 
                      onClick={handleSetupBiometrics}
                      disabled={isSaving}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isBiometricEnabled ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'} disabled:opacity-50`}
                    >
                      {isBiometricEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </div>
              )}


            </div>
          </ModalSheet>
        )}

        {/* ── Categories Modal ──────────────────────────────────────────── */}
        {modal === 'categories' && (
          <ModalSheet title="Kelola Kategori" onClose={() => setModal(null)}>
            <div className="space-y-4">
              {[
                { type: 'income',   label: 'Pemasukan',   emoji: '💰', color: 'emerald', bgClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                { type: 'expense',  label: 'Pengeluaran', emoji: '💸', color: 'rose', bgClass: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' },
                { type: 'transfer', label: 'Transfer',    emoji: '🔄', color: 'blue', bgClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                { type: 'asset',    label: 'Aset',        emoji: '🏦', color: 'violet', bgClass: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
                { type: 'debt',     label: 'Utang',       emoji: '📋', color: 'orange', bgClass: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' },
              ].map(({ type, label, emoji, color, bgClass }) => (
                <div key={type} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className={`flex items-center gap-3 p-3.5 ${bgClass} border-b border-slate-200 dark:border-slate-800`}>
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
                    <span className="ml-auto text-xs font-medium text-slate-400 dark:text-slate-500">{getCategoryOptions(type, customCategories).length} kategori</span>
                  </div>
                  <div className="p-3 flex flex-wrap gap-2">
                    {getCategoryOptions(type, customCategories).map(cat => {
                      const isCustom = customCategories[type]?.includes(cat);
                      return (
                        <span key={cat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isCustom ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                          {cat}
                          {isCustom && (
                            <button onClick={() => handleDeleteCustomCategory(type, cat)} className="hover:text-rose-500 transition-colors ml-1">
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  
                  <div className="p-3 pt-0 flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Tambah kategori..." 
                      value={newCat.type === type ? newCat.value : ''}
                      onChange={e => setNewCat({ type, value: e.target.value })}
                      onKeyDown={e => { if(e.key === 'Enter') handleAddCustomCategory(type) }}
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                    <button 
                      onClick={() => handleAddCustomCategory(type)}
                      disabled={isSaving || !newCat.value || newCat.type !== type}
                      className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2">
                Kategori bawaan SteFin (warna abu-abu) tidak dapat dihapus. Anda dapat menambahkan kategori kustom (warna hijau).
              </p>
            </div>
          </ModalSheet>
        )}

        {/* ── Appearance Modal ──────────────────────────────────────────── */}
        {modal === 'appearance' && (
          <ModalSheet title="Personalisasi Tampilan" onClose={() => setModal(null)}>
            <div className="space-y-6">
              {/* Theme Toggle */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Mode Tampilan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => onThemeChange?.('light')}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all ${
                      theme === 'light' 
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-md shadow-emerald-500/10' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center">
                      <Sun size={22} className="text-amber-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Light</span>
                    {theme === 'light' && <Check size={16} className="text-emerald-500" />}
                  </button>
                  <button onClick={() => onThemeChange?.('dark')}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all ${
                      theme === 'dark' 
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-md shadow-emerald-500/10' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border-2 border-slate-700 shadow-sm flex items-center justify-center">
                      <Moon size={22} className="text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Dark</span>
                    {theme === 'dark' && <Check size={16} className="text-emerald-500" />}
                  </button>
                </div>
              </div>


            </div>
          </ModalSheet>
        )}

        {/* ── Currency Modal ────────────────────────────────────────────── */}
        {modal === 'currency' && (
          <ModalSheet title="Penyesuaian Mata Uang" onClose={() => setModal(null)}>
            <div className="space-y-2">
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { localStorage.setItem('stefin_currency', c.code); setModal(null); window.location.reload(); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                    currency === c.code 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                    currency === c.code 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>{c.symbol}</div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.code}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
                  </div>
                  {currency === c.code && <Check size={18} className="text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-3">
                Pengaturan ini hanya mengubah simbol tampilan. Konversi nilai tidak dilakukan secara otomatis.
              </p>
            </div>
          </ModalSheet>
        )}

        {/* ── Language Modal ──────────────────────────────────────────────── */}
        {modal === 'language' && (
          <ModalSheet title="Preferensi Bahasa" onClose={() => setModal(null)}>
            <div className="space-y-2">
              {[
                { code: 'id', label: 'Bahasa Indonesia (ID)' },
                { code: 'en', label: 'English (EN)' }
              ].map(l => (
                <button key={l.code} onClick={() => { changeLang(l.code); setModal(null); }}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                    lang === l.code 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold uppercase ${
                    lang === l.code 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>{l.code}</div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{l.label}</div>
                  </div>
                  {lang === l.code && <Check size={18} className="text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </ModalSheet>
        )}

        {/* ── Privacy Modal ─────────────────────────────────────────────── */}
        {modal === 'privacy' && (
          <ModalSheet title="Kebijakan & Privasi" onClose={() => setModal(null)}>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-500" /> Perlindungan Data</h4>
                <p>Data keuangan Anda disimpan dan dikelola pada infrastruktur komputasi awan yang aman. Seluruh transaksi dicatat secara langsung ke basis data pribadi tanpa ada pihak ketiga yang dapat mengakses rekam jejak tersebut.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Lock className="w-5 h-5 text-emerald-500" /> Autentikasi Modern</h4>
                <p>Prosedur masuk terlindungi oleh arsitektur Firebase Authentication dari Google. Keamanan lapisan aplikasi ditopang oleh enkripsi standar (TLS).</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><User className="w-5 h-5 text-emerald-500" /> Kedaulatan Data</h4>
                <p>Anda memegang kendali penuh atas privasi Anda. Pengguna dapat mengekspor dan menghapus seluruh jejak data secara permanen tanpa retensi.</p>
              </div>
              <div className="pt-2 text-center border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  Pembaruan: Mei 2026 · SteFin v2.0
                </p>
              </div>
            </div>
          </ModalSheet>
        )}

        {/* ── Help / FAQ Modal ──────────────────────────────────────────── */}
        {modal === 'help' && (
          <ModalSheet title="Pusat Bantuan Terpadu" onClose={() => setModal(null)}
            footer={
              <a href="mailto:contact@langka13.com?subject=Bantuan SteFin App" className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 font-bold tracking-wide transition shadow-md hover:opacity-90">
                <MessageSquare className="w-4 h-4" /> Hubungi Dukungan Operasional
              </a>
            }
          >
            <div className="space-y-4">
              {[
                { q: 'Bagaimana keamanan data saya?', a: 'Seluruh struktur skema data Anda dilindungi oleh arsitektur backend Firebase. Hanya Anda yang memiliki akses sesi terenkripsi.' },
                { q: 'Mengapa laporan PDF kosong?', a: 'Modul PDF memproses seluruh entri pada periode terpilih (Mingguan/Bulanan). Pastikan Anda telah menyeleksi filter yang memiliki setidaknya satu transaksi.' },
                { q: 'Bagaimana fitur Multi-Bahasa bekerja?', a: 'Setiap antarmuka dikonversi ke dalam sistem pelokalan terpusat, mempermudah penggantian bahasa secara presisi.' },
                { q: 'Bisakah saya mengunci aplikasi dengan PIN?', a: 'Ya. Anda dapat mengaktifkan kode proteksi PIN 6-digit via menu Pengaturan Keamanan untuk lapisan tambahan.' },
              ].map(({ q, a }, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-sm">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">{q}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{a}</p>
                </div>
              ))}
            </div>
          </ModalSheet>
        )}

        {/* ── PWA Manual Install Help Modal ───────────────────────────────── */}
        {modal === 'pwa_help' && (
          <ModalSheet title="Cara Instalasi SteFin (PWA)" onClose={() => setModal(null)}>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Safari (iPhone / iPad)</h4>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Ketuk tombol <span className="font-bold">Share (Bagikan)</span> di menu navigasi bawah.</li>
                  <li>Gulir ke bawah dan ketuk opsi <span className="font-bold">Tambahkan ke Layar Utama</span> (Add to Home Screen).</li>
                  <li>Ketuk <span className="font-bold">Tambah</span> untuk menyelesaikan pemasangan.</li>
                </ol>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Chrome (Android / Desktop)</h4>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Ketuk tombol ikon <span className="font-bold">Menu tiga titik (&#8942;)</span> di pojok kanan atas browser.</li>
                  <li>Pilih opsi <span className="font-bold">Instal Aplikasi</span> (Install app).</li>
                  <li>Ikuti petunjuk pada layar untuk menambahkan shortcut SteFin.</li>
                </ol>
              </div>
              <div className="pt-2">
                <button onClick={() => setModal(null)} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition">
                  Tutup Panduan
                </button>
              </div>
            </div>
          </ModalSheet>
        )}

      </div>
    </section>
  )
})
