import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { Loader2 } from 'lucide-react';
import { AppLogo } from './AppLogo.jsx';

export function LoginScreen({ authError, setAuthError, onEmail, onGoogle, onResetPassword }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onEmail(name, email, password, isRegister);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    await onGoogle();
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setAuthError('Masukkan email Anda terlebih dahulu.');
      return;
    }
    setLoading(true);
    const res = await onResetPassword(email);
    if (res.success) {
      setAuthError('');
      setResetSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-900 px-4 py-10 text-slate-900 dark:text-slate-50">
      <div className="relative w-full max-w-md">
        <div className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 shadow-sm">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <AppLogo className="w-20 h-20 drop-shadow-lg" />
            <div className="text-3xl font-outfit font-semibold">SteFin</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('app_desc')}</p>
          </div>

          {/* Tab toggle */}

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-white dark:bg-slate-900 p-1">
            {[t('login'), t('register')].map((label, i) => (
              <button
                key={label} type="button"
                onClick={() => { setIsRegister(i === 1); setAuthError(null); }}
                className={`rounded-xl py-2.5 text-sm font-medium transition ${(i === 1) === isRegister ? 'bg-brand-lime shadow-lg shadow-brand-lime/20 text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Error */}
          {authError && (
            <div className="mb-4 rounded-2xl border border-rose-800/50 bg-rose-900/20 px-4 py-3 text-sm text-rose-400 font-outfit font-semibold">
              {authError}
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-3">
            {isRegister && (
              <input
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300"
                placeholder={t('fullname')}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}
            <input
              type="email"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300"
              placeholder={t('email')}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3 text-slate-900 dark:text-slate-50 outline-none transition focus:border-emerald-500 placeholder:text-slate-600 dark:text-slate-300"
              placeholder={t('password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {!isRegister && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                {t('forgot_password', 'Lupa kata sandi?')}
              </button>
            </div>
          )}

          {resetSent && (
             <div className="mt-4 rounded-2xl border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-400 font-outfit font-semibold text-center">
               {t('reset_password_sent', 'Email peresetan kata sandi telah dikirim. Periksa kotak masuk Anda!')}
             </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-lime py-3.5 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRegister ? t('register') : t('login'))}
          </button>

          <div className="my-6 flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('or')}</div>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white p-3.5 text-sm font-medium text-slate-900 dark:bg-slate-900 dark:text-slate-50 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {t('login_with_google')}
          </button>
        </div>
      </div>
    </div>
  );
}
