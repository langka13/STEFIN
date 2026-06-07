import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Camera, Loader2, Mic, MicOff, Image as ImageIcon } from 'lucide-react';
import { useFinancial } from '../contexts/FinancialContext.jsx';
import { parseTransactionLocal } from '../utils/parseTransactionLocal.js';

function compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// ─── Normalisasi draft dari AI/parser agar field selalu konsisten ──────────
function normalizeDraft(draft) {
  const d = { ...draft };
  // Pastikan amount selalu number
  if (d.amount !== undefined && d.amount !== null) {
    d.amount = typeof d.amount === 'string' ? parseInt(d.amount.replace(/\D/g, ''), 10) || 0 : Number(d.amount) || 0;
  }
  // Pastikan date ada
  if (!d.date) d.date = new Date().toISOString().split('T')[0];
  // Pastikan type ada
  if (!d.type) d.type = 'expense';
  return d;
}

export default function ConversationalEntry() {
  const { accounts } = useFinancial();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);

  const recognitionRef = useRef(null);
  const inputRef = useRef('');
  const isProcessingRef = useRef(false);
  const accountsRef = useRef(accounts);

  // Keep refs in sync
  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);

  // ─── Dispatch draft ke TransactionModal ──────────────────────────────────
  const dispatchDraft = useCallback((draft) => {
    const normalized = normalizeDraft(draft);
    // Auto-fill accountId jika cuma punya 1 akun
    if (!normalized.accountId && accountsRef.current.length === 1) {
      normalized.accountId = accountsRef.current[0].id;
    }
    console.log('[SmartEntry] Dispatching draft:', normalized);
    window.dispatchEvent(
      new CustomEvent('stefin_navigate_add_transaction_with_draft', { detail: normalized })
    );
  }, []);

  // ─── Parse input via API lalu fallback ke parser lokal ───────────────────
  const parseInput = useCallback(async (text, imgBase64) => {
    if (isProcessingRef.current) return;
    setIsProcessing(true);
    setStatusMsg(imgBase64 ? '📷 Membaca gambar...' : '🤖 AI sedang menganalisis...');

    const accs = accountsRef.current;
    const accountsCtx = accs.map(a => `{id:"${a.id}",name:"${a.name}"}`).join(',');
    const fullText = text
      ? `${text}\n\nAkun tersedia: ${accountsCtx}`
      : `Ekstrak transaksi dari foto/struk ini. Akun tersedia: ${accountsCtx}`;

    let result = null;
    let aiWorked = false;
    let lastApiError = '';

    // ── Tahap 1: Coba AI / Gemini API ──────────────────────────────────────
    try {
      const res = await fetch('/api/extract-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          imageBase64: imgBase64 || undefined,
        }),
      });

      if (res.ok) {
        const parsed = await res.json();
        // Cek jika AI benar-benar mengekstrak nominal
        const validAmount = parsed && parsed.amount > 0;
        
        if (validAmount || (imgBase64 && parsed && (parsed.type || parsed.note))) {
          result = parsed;
          aiWorked = true;
          console.log('[SmartEntry] AI result:', result);
        } else {
          console.warn('[SmartEntry] AI missing amount, treating as failed.');
          lastApiError = 'AI tidak menemukan nominal';
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        lastApiError = errBody.error || `HTTP ${res.status}`;
        console.warn('[SmartEntry] API error:', res.status, errBody);
      }
    } catch (err) {
      lastApiError = err.message;
      console.warn('[SmartEntry] API fetch failed:', err.message);
    }

    // ── Tahap 2: Fallback parser lokal (hanya untuk teks, bukan gambar) ────
    if (!aiWorked && text && !imgBase64) {
      console.log('[SmartEntry] Falling back to local parser for:', text);
      setStatusMsg('⚡ Menggunakan parser lokal...');
      const local = parseTransactionLocal(text, accs);
      if (local && local.amount > 0) {
        result = local;
        console.log('[SmartEntry] Local parser result:', result);
      }
    }

    // ── Tahap 3: Jika semua gagal ──────────────────────────────────────────
    if (!result || (!result.amount && !imgBase64)) {
      if (imgBase64) {
        // Foto gagal diekstrak — buka modal kosong dengan pesan
        setStatusMsg('');
        setIsProcessing(false);
        const errMsg = lastApiError || 'API error atau limit';
        alert(`Gagal membaca gambar (${errMsg}). Pastikan foto jelas atau ukuran tidak terlalu besar.`);
        return;
      }
      // Teks gagal — tetap buka modal dengan note terisi agar user bisa isi manual
      result = {
        type: 'expense',
        note: text,
        date: new Date().toISOString().split('T')[0],
      };
    }

    dispatchDraft(result);
    setStatusMsg('');
    setIsProcessing(false);
  }, [dispatchDraft]);

  // ─── Inisialisasi Speech Recognition (1x saja) ──────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false; // Changed from true to prevent duplicate text bugs on Android
    recognition.interimResults = true;

    let startSnapshot = '';
    let finalParts = '';

    recognition.onstart = () => {
      startSnapshot = inputRef.current || '';
      finalParts = '';
    };

    recognition.onresult = (event) => {
      let finalStr = '';
      let interimStr = '';
      
      for (let i = 0; i < event.results.length; ++i) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalStr += t + ' ';
        } else {
          interimStr += t;
        }
      }
      
      const prefix = startSnapshot ? startSnapshot + ' ' : '';
      setInput(prefix + finalStr + interimStr);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-submit dihidupkan kembali karena user meminta, tapi dengan jeda
      const finalText = (inputRef.current || '').trim();
      if (finalText && !isProcessingRef.current) {
        setInput('');
        setTimeout(() => {
          parseInput(finalText, null);
        }, 500);
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      setIsListening(false);
      if (e.error === 'not-allowed') {
        alert('Akses mikrofon ditolak. Izinkan di pengaturan browser.');
      }
    };

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── PWA Share Target ────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.launchQueue?.setConsumer) return;
    window.launchQueue.setConsumer(async (launchParams) => {
      const fileList = launchParams.files ? await launchParams.files : [];
      const file = fileList[0];
      if (!file) return;
      const b64 = await compressImage(file);
      if (b64) await parseInput('', b64);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handler: Submit teks ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isProcessing) return;
    const val = input.trim();
    if (!val) return;

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch (_) {}
      setIsListening(false);
    }

    setInput('');
    await parseInput(val, null);
  };

  // ─── Handler: File upload (galeri + kamera) ──────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset agar bisa upload file yang sama lagi

    setStatusMsg('📷 Mengompresi gambar...');
    const b64 = await compressImage(file);
    if (!b64) {
      alert('Gagal memproses gambar. Coba file lain.');
      setStatusMsg('');
      return;
    }

    const currentInput = input.trim();
    setInput('');
    await parseInput(currentInput, b64);
  };

  // ─── Handler: Toggle voice ──────────────────────────────────────────────
  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('Maaf, browser Anda tidak mendukung fitur input suara.');
      return;
    }
    if (isListening) {
      try { recognitionRef.current.stop(); } catch (_) {}
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        // InvalidStateError — abort lalu restart
        console.warn('Recognition restart needed:', err.message);
        try { recognitionRef.current.abort(); } catch (_) {}
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e2) {
            console.error('Failed to start recognition:', e2);
            alert('Gagal mengaktifkan mikrofon. Coba refresh halaman.');
          }
        }, 250);
      }
    }
  };

  return (
    <div className="mb-8 w-full relative group">
      {/* Animated glowing border background */}
      <div className="absolute -inset-[2px] bg-emerald-500 rounded-full blur-sm opacity-50 group-hover:opacity-100 transition duration-500 animate-pulse"></div>
      
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-2 rounded-full border border-white/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-3 py-2.5 shadow-2xl focus-within:ring-4 focus-within:ring-emerald-500/30 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all"
      >
        {/* Left buttons: Voice + Photo + Camera */}
        <div className="flex items-center gap-1 pl-1 shrink-0">
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              disabled={isProcessing}
              className={`p-2 rounded-full transition-all ${
                isListening
                  ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/20 ring-2 ring-rose-400 animate-pulse'
                  : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-slate-800'
              } disabled:opacity-40`}
              title={isListening ? 'Stop rekaman' : 'Input suara'}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}

          {/* Tombol Scan/Upload (Tanpa capture agar di mobile bisa pilih Camera/Gallery) */}
          <label
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isProcessing
                ? 'text-slate-300 dark:text-slate-600 pointer-events-none'
                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-slate-800'
            }`}
            title="Scan atau upload struk/mutasi"
          >
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </label>
        </div>

        {/* Input teks */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isProcessing
              ? statusMsg || 'Memproses...'
              : isListening
                ? '🎤 Mendengarkan........'
                : 'Ketik "beli bensin 20rb" atau upload struk...'
          }
          disabled={isProcessing}
          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-50 outline-none px-2 min-w-0 disabled:opacity-60"
        />

        {/* Tombol kirim */}
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-40 transition"
        >
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </button>
      </form>

      {/* Status indicator */}
      {isListening && (
        <p className="mt-2 text-center text-xs text-rose-500 dark:text-rose-400 animate-pulse font-medium">
          ● Merekam suara... Ucapkan transaksi (otomatis terkirim saat selesai bicara).
        </p>
      )}
      {isProcessing && statusMsg && (
        <p className="mt-2 text-center text-xs text-emerald-500 dark:text-emerald-400 font-medium">
          {statusMsg}
        </p>
      )}
      {!isListening && !isProcessing && (
        <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
          Suara, ketik, atau kirim foto → isi form otomatis
        </p>
      )}
    </div>
  );
}
