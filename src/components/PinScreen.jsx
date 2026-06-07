import React, { useState, useCallback, useEffect } from 'react';
import { Shield, Fingerprint, Delete, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { authenticateBiometric } from '../utils/biometrics.js';

export const PinScreen = ({ savedPin, isBiometricEnabled, biometricCredentialId, onUnlock, onReset }) => {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleBiometricAuth = useCallback(async () => {
    if (!isBiometricEnabled || isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const isValid = await authenticateBiometric(biometricCredentialId);
      if (isValid) {
        onUnlock();
      } else {
        // Biometric failed or cancelled, do nothing to allow PIN entry
      }
    } catch (e) {
      console.error(e);
      // fallback to pin
    } finally {
      setIsAuthenticating(false);
    }
  }, [isBiometricEnabled, isAuthenticating, onUnlock]);

  useEffect(() => {
    if (isBiometricEnabled) {
      handleBiometricAuth();
    }
  }, [isBiometricEnabled]); // Removed handleBiometricAuth from deps to avoid loop on load

  // Verifikasi PIN — dipanggil langsung saat digit ke-6 masuk, bukan lewat useEffect
  const verify = useCallback((fullPin) => {
    if (fullPin === savedPin) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 800);
    }
  }, [savedPin, onUnlock]);

  const handleKeypad = useCallback((num) => {
    if (error) return;
    setPin(prev => {
      if (prev.length >= 6) return prev;
      const next = prev + num;
      if (next.length === 6) {
        // Verifikasi di sini — satu kali, sinkron
        setTimeout(() => verify(next), 0);
      }
      return next;
    });
  }, [error, verify]);

  const handleDelete = useCallback(() => {
    if (!error) setPin(prev => prev.slice(0, -1));
  }, [error]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showReset) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKeypad(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeypad, handleDelete, showReset]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-brand-lime/20 flex items-center justify-center mb-6">
          <Shield className="text-brand-lime w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold font-outfit mb-2">{t('enter_pin', 'Masukkan PIN')}</h1>
        <p className="text-slate-400 text-sm mb-8 text-center max-w-xs">
          {t('enter_pin_desc', 'Silakan masukkan 6 digit PIN keamanan SteFin Anda untuk melanjutkan.')}
        </p>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-12">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${error ? 'pin-shake bg-rose-500' : i < pin.length ? 'bg-brand-lime' : 'bg-slate-800'}`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 sm:gap-6 w-full max-w-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeypad(num.toString())}
              className="h-16 rounded-2xl bg-slate-900 active:bg-slate-800 flex items-center justify-center text-2xl font-semibold transition-colors"
            >
              {num}
            </button>
          ))}

          <div className="h-16 flex items-center justify-center">
            {isBiometricEnabled && (
              <button
                onClick={handleBiometricAuth}
                className="w-16 h-16 rounded-2xl text-violet-400 bg-violet-500/10 active:bg-violet-500/20 flex items-center justify-center transition-colors"
              >
                <Fingerprint size={32} />
              </button>
            )}
          </div>

          <button
            onClick={() => handleKeypad('0')}
            className="h-16 rounded-2xl bg-slate-900 active:bg-slate-800 flex items-center justify-center text-2xl font-semibold transition-colors"
          >
            0
          </button>

          <div className="h-16 flex items-center justify-center">
            <button
              onClick={handleDelete}
              className="w-16 h-16 rounded-2xl text-slate-400 active:bg-slate-900 flex items-center justify-center transition-colors"
            >
              <Delete size={28} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowReset(true)}
          className="mt-12 text-sm text-slate-500 hover:text-white transition-colors font-medium"
        >
          {t('forgot_pin', 'Lupa PIN Anda?')}
        </button>
      </div>

      {showReset && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-backdrop-enter">
          <div className="modal-enter bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{t('security_reset', 'Reset Keamanan')}</h3>
            <p className="text-slate-400 text-sm mb-6">
              {t('reset_pin_desc', 'Untuk alasan keamanan, Anda harus melakukan logout dan masuk kembali menggunakan email/sandi untuk menghapus PIN.')}
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={onReset} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition">
                {t('logout_delete_pin', 'Logout & Hapus PIN')}
              </button>
              <button onClick={() => setShowReset(false)} className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition">
                {t('cancel', 'Batal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

