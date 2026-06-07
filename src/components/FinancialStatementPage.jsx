import { useMemo, memo, useState } from 'react';
import { Edit3, Trash2, Download, FileText, Calendar, TrendingUp, TrendingDown, Info, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { formatIDR, displayIDR } from '../utils/constants.js';
import { useFinancial } from '../contexts/FinancialContext.jsx';
import { exportToPDF, exportToExcel } from '../utils/exportReport.js';
import EmptyState from './EmptyState.jsx';
import DataTable from './DataTable.jsx';
import { PeriodSelectorCard } from './PeriodSelectorCard.jsx';
import { useAuth } from '../hooks/useAuth.js';

export const FinancialStatementPage = memo(function FinancialStatementPage({ onEdit, onDelete }) {
  const { t, privacyMode } = useLanguage();
  const { transactions, txFilter, setTxFilter, accounts, dateRange, netWorthData, totalBalance } = useFinancial();
  const { user } = useAuth();
  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  const dateRangeStr = useMemo(() => {
    const s = dateRange.start.toLocaleDateString('id-ID');
    const e = dateRange.end.toLocaleDateString('id-ID');
    return `${s} - ${e}`;
  }, [dateRange]);

  // ── Derived Transactions ──
  const { filteredTx, summary } = useMemo(() => {
    const startMs = dateRange.start.getTime();
    const endMs = dateRange.end.getTime();

    const filtered = transactions.filter(tx => {
      const d = new Date(tx.date).getTime();
      return d >= startMs && d <= endMs;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const s = { income: 0, expense: 0, assetOut: 0, piutangOut: 0, piutangIn: 0, debtIn: 0, debtOut: 0, totalIn: 0, totalOut: 0, netCashflow: 0 };
    filtered.forEach(tx => {
      if (tx.type === 'income') s.income += tx.amount;
      if (tx.type === 'expense') s.expense += tx.amount;
      if (tx.type === 'asset' && tx.category !== 'Settlement' && !tx.isInitial) s.assetOut += tx.amount;
      if (tx.type === 'transfer' && tx.category === 'Piutang' && !tx.isInitial) s.piutangOut += tx.amount;
      if (tx.type === 'asset' && tx.category === 'Settlement') s.piutangIn += tx.amount;
      if (tx.type === 'debt' && tx.category !== 'Pelunasan' && !tx.isInitial) s.debtIn += tx.amount;
      if (tx.type === 'debt' && tx.category === 'Pelunasan') s.debtOut += tx.amount;
    });
    s.totalIn = s.income + s.piutangIn + s.debtIn;
    s.totalOut = s.expense + s.assetOut + s.piutangOut + s.debtOut;
    s.netCashflow = s.totalIn - s.totalOut;

    return { filteredTx: filtered, summary: s };
  }, [transactions, dateRange]);

  // --- Health Metrics & Info ---
  const { assetsList, activePiutang, activeUtang } = useMemo(() => {
    const isPiutang = (tx) => tx.type === 'transfer' && (tx.category === 'Piutang Personal' || tx.category === 'Piutang Usaha' || tx.category === 'Piutang');
    const isDebt = (tx) => tx.type === 'debt' && tx.category !== 'Pelunasan';
    const isSettlement = (tx) => tx.type === 'asset' && tx.category === 'Settlement';
    const isDebtPayment = (tx) => tx.type === 'debt' && tx.category === 'Pelunasan';
    const isAsset = (tx) => tx.type === 'asset' && tx.category !== 'Settlement';

    const pGroups = {}, uGroups = {};
    const assList = [];

    (transactions || []).forEach(tx => {
      if (isPiutang(tx)) {
        const key = (tx.note || tx.category || 'Lainnya').trim();
        if (!pGroups[key]) pGroups[key] = { nominal: 0, paid: 0 };
        pGroups[key].nominal += tx.amount;
      }
      if (isDebt(tx)) {
        const key = (tx.note || tx.category || 'Lainnya').trim();
        if (!uGroups[key]) uGroups[key] = { nominal: 0, paid: 0 };
        uGroups[key].nominal += tx.amount;
      }
      if (isSettlement(tx)) {
        const pKey = (tx.note || '').trim() || Object.keys(pGroups)[0];
        if (pKey && pGroups[pKey]) pGroups[pKey].paid += tx.amount;
      }
      if (isDebtPayment(tx)) {
        const uKey = (tx.note || '').trim() || Object.keys(uGroups)[0];
        if (uKey && uGroups[uKey]) uGroups[uKey].paid += tx.amount;
      }
      if (isAsset(tx)) {
        assList.push(tx);
      }
    });

    return {
      assetsList: assList.sort((a,b)=>new Date(b.date)-new Date(a.date)),
      activePiutang: Object.entries(pGroups).map(([k,v])=>({name:k, sisa: Math.max(0, v.nominal - v.paid)})).filter(x=>x.sisa>0),
      activeUtang: Object.entries(uGroups).map(([k,v])=>({name:k, sisa: Math.max(0, v.nominal - v.paid)})).filter(x=>x.sisa>0)
    };
  }, [transactions]);

  const mIncome = summary.income || 0;
  const mExpense = summary.expense || 0;
  const saldoKas = totalBalance || 0;
  const totalAsetVal = assetsList.reduce((s, a) => s + a.amount, 0);
  const sisaPiutangTotal = activePiutang.reduce((s, p) => s + p.sisa, 0);
  const sisaUtangTotal = activeUtang.reduce((s, u) => s + u.sisa, 0);

  const savingsRate = mIncome > 0 ? Math.round(((mIncome - mExpense) / mIncome) * 100) : 0;
  const rasioUtang = saldoKas > 0 ? Math.round((sisaUtangTotal / saldoKas) * 100) : (sisaUtangTotal > 0 ? 999 : 0);
  const avgExpense = Math.max(mExpense, 2000000); 
  const emergencyTarget = avgExpense * 6;
  const emergencyProgress = Math.min(100, Math.round((saldoKas/emergencyTarget)*100));

  const [localTxFilter, setLocalTxFilter] = useState('all');
  const displayList = useMemo(() => {
    if (localTxFilter === 'all') return filteredTx;
    if (localTxFilter === 'asset') return filteredTx.filter(t => t.type === 'asset' || t.type === 'transfer' || t.type === 'debt');
    return filteredTx.filter(t => t.type === localTxFilter);
  }, [filteredTx, localTxFilter]);

  const [loadingPdf, setLoadingPdf] = useState(false);

  const handleExportPDF = async () => {
    if (filteredTx.length === 0) return;
    setLoadingPdf(true);
    try {
      const allTx = transactions;
      exportToPDF(filteredTx, summary, dateRangeStr, null, netWorthData, totalBalance, allTx, accounts, user, t);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExportExcel = () => exportToExcel(filteredTx, summary, dateRangeStr);

  // ── Income breakdown ──
  const incomeByAccount = useMemo(() => {
    const map = {};
    filteredTx.filter(tx => tx.type === 'income').forEach(tx => {
      const key = accMap[tx.accountId]?.name || 'Akun';
      if (!map[key]) map[key] = { amount: 0, categories: {} };
      map[key].amount += tx.amount;
      map[key].categories[tx.category] = (map[key].categories[tx.category] || 0) + tx.amount;
    });
    return Object.entries(map);
  }, [filteredTx, accMap]);

  const expenseByAccount = useMemo(() => {
    const map = {};
    filteredTx.filter(tx => tx.type === 'expense').forEach(tx => {
      const key = accMap[tx.accountId]?.name || 'Akun';
      if (!map[key]) map[key] = { amount: 0, categories: {} };
      map[key].amount += tx.amount;
      map[key].categories[tx.category] = (map[key].categories[tx.category] || 0) + tx.amount;
    });
    return Object.entries(map);
  }, [filteredTx, accMap]);

  return (
    <section className="space-y-6 pb-8 font-sans">
      {/* ── HEADER OJK STYLE ── */}
      <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-4 relative overflow-hidden shadow-lg border border-slate-800">
        <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
          <FileText className="w-24 h-24 text-white" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4">
          <div className="flex-1">
            <h1 className="text-base md:text-lg font-bold uppercase tracking-tight text-white mb-1">
              LAPORAN KEUANGAN
            </h1>
            <p className="text-slate-300 max-w-xl text-[10px] md:text-xs leading-relaxed border-l-2 border-emerald-400 pl-2 py-0.5 italic">
              "Kondisi kas dan manajemen beban. Berdasarkan transaksi periode terpilih."
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-none text-left md:text-right bg-slate-800/80 p-2 sm:p-3 rounded-lg border border-slate-700/50 backdrop-blur min-w-[150px]">
              <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5 flex items-center md:justify-end gap-1">
                <Info className="w-2.5 h-2.5 text-emerald-400" /> Pengguna Aktif
              </p>
              <p className="font-bold text-white text-xs md:text-sm truncate">{user?.displayName || user?.name || 'User'}</p>
              <p className="text-[9px] md:text-[10px] text-slate-400 truncate max-w-[150px]">{user?.email || 'N/A'}</p>
            </div>
            
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={handleExportPDF}
                disabled={loadingPdf}
                className="flex items-center justify-center p-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 border border-emerald-500/30 transition shadow-sm disabled:opacity-60 h-8 w-8"
                title="Unduh PDF"
              >
                {loadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition shadow-sm h-8 w-8"
                title="Unduh Excel"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER PERIODE ── */}
      <div className="bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center sm:justify-start">
        <PeriodSelectorCard />
      </div>

      {/* ── METRIK GLOBAL (ARUS KAS) ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b-2 border-emerald-500 pb-2 mb-4 inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Perkembangan Arus Kas Kasar
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 sm:mb-2">Debit Masuk (In)</p>
            <p className="text-sm sm:text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-500 tabular-nums truncate">{displayIDR(summary.totalIn, privacyMode)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 sm:mb-2">Kredit Keluar (Out)</p>
            <p className="text-sm sm:text-xl md:text-2xl font-black text-rose-600 dark:text-rose-500 tabular-nums truncate">{displayIDR(summary.totalOut, privacyMode)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 sm:mb-2">Saldo Arus Kas</p>
            <p className={`text-sm sm:text-xl md:text-2xl font-black tabular-nums truncate ${summary.netCashflow >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {summary.netCashflow >= 0 ? '+' : ''}{displayIDR(summary.netCashflow, privacyMode)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm flex flex-col justify-center items-center">
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 sm:mb-2">Net Worth Total</p>
            <p className="text-sm sm:text-xl md:text-2xl font-black text-slate-800 dark:text-white tabular-nums truncate">{displayIDR(netWorthData?.netWorth || 0, privacyMode)}</p>
          </div>
        </div>
      </div>

      {/* ── 2 PANELS : ASET & UTANG ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
        
        {/* PANEL KIRI: Rasio & Aset */}
        <div className="bg-slate-50 dark:bg-slate-800/20 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="bg-emerald-600 px-4 py-3 sm:px-6 sm:py-4 text-white font-bold tracking-wider uppercase text-xs sm:text-sm flex items-center gap-3">
            <div className="w-1.5 h-4 bg-emerald-300 rounded-full"></div>
            Kesehatan & Aset Simpanan
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-8 flex-1">
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
               <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold mb-1 sm:mb-1.5 uppercase tracking-wider">Rasio Tabungan</p>
                  <span className={`text-xl sm:text-3xl font-black ${savingsRate >= 20 ? 'text-emerald-600 dark:text-emerald-500' : (savingsRate > 0 ? 'text-amber-500' : 'text-rose-500')}`}>{savingsRate}%</span>
                  <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-1 sm:mt-2">{savingsRate >= 20 ? 'Ideal (>20%)' : 'Kurang Ideal (<20%)'}</p>
               </div>
               <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 dark:border-slate-800">
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold mb-1 sm:mb-1.5 uppercase tracking-wider mt-[-2px] leading-tight">Rasio Utang Kas</p>
                  <span className={`text-xl sm:text-3xl font-black ${rasioUtang <= 30 ? 'text-emerald-600 dark:text-emerald-500' : (rasioUtang <= 100 ? 'text-amber-500' : 'text-rose-500')}`}>{rasioUtang}%</span>
                  <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-1 sm:mt-2">Total Utang dibagi Kas</p>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
              <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-2 sm:mb-3 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Target Dana Darurat</p>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tabular-nums">{displayIDR(saldoKas, privacyMode)}</span>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wide">Target: {displayIDR(emergencyTarget, privacyMode)}</span>
              </div>
              <div className="h-2.5 sm:h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${emergencyProgress}%` }}></div>
              </div>
              <p className="text-right text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{emergencyProgress}% Tercapai</p>
            </div>

            <div>
              <p className="text-[9px] sm:text-[10px] text-blue-600 border-b border-blue-100 dark:border-blue-900/30 pb-2 font-bold mb-3 sm:mb-4 uppercase tracking-widest mt-4 sm:mt-0">Aset Investasi & Piutang</p>
              <div className="flex justify-between items-center mb-2.5 sm:mb-3 bg-white dark:bg-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Aset Simpanan</span>
                <span className="text-sm sm:text-base font-black text-emerald-600">{displayIDR(totalAsetVal, privacyMode)}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-amber-100 dark:border-amber-900/30">
                <span className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider">Piutang Berjalan</span>
                <span className="text-sm sm:text-base font-black text-amber-600">{displayIDR(sisaPiutangTotal, privacyMode)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: Utang & Transaksi Terbesar */}
        <div className="bg-slate-50 dark:bg-slate-800/20 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="bg-rose-600 px-4 py-3 sm:px-6 sm:py-4 text-white font-bold tracking-wider uppercase text-xs sm:text-sm flex items-center gap-3">
             <div className="w-1.5 h-4 bg-rose-300 rounded-full"></div>
             Kewajiban & Pengeluaran
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-8 flex-1">
            
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-rose-100 dark:border-rose-900/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                <TrendingDown className="w-16 h-16 sm:w-24 sm:h-24 text-rose-600" />
              </div>
              <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                <p className="text-[9px] sm:text-[10px] font-bold text-rose-500 uppercase tracking-widest">Sisa Kewajiban Utang</p>
              </div>
              <p className="text-2xl sm:text-4xl font-black text-slate-800 dark:text-slate-100 tabular-nums relative z-10">{displayIDR(sisaUtangTotal, privacyMode)}</p>
              {activeUtang.length > 0 && (
                <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 relative z-10">
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rincian Hutang:</p>
                  {activeUtang.slice(0,3).map((u, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[60%]">{u.name}</span>
                      <span className="text-xs sm:text-sm font-bold text-rose-600 tabular-nums">{displayIDR(u.sisa, privacyMode)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
               <p className="text-[9px] sm:text-[10px] text-rose-600 border-b border-rose-100 dark:border-rose-900/30 pb-2 font-bold mb-3 sm:mb-4 uppercase tracking-widest mt-4 sm:mt-0">Distribusi Pengeluaran Teratas</p>
               <div className="space-y-2 sm:space-y-3">
                {Object.entries(
                  filteredTx.filter(tx => tx.type === 'expense')
                    .reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc; }, {})
                ).sort((a,b)=>b[1]-a[1]).slice(0, 4).map(([cat, amount], idx) => (
                  <div key={cat} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-slate-500">{idx+1}</div>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 capitalize tracking-wide">{cat}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-rose-600 tabular-nums">{displayIDR(amount, privacyMode)}</span>
                  </div>
                ))}
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── TRANSACTION JOURNAL (TABLE) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden flex flex-col mt-8">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" /> Jurnal Umum Transaksi
            </h3>
            <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">{displayList.length} entri pada periode terpilih</p>
          </div>
          <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-700 overflow-x-auto text-[10px] font-bold uppercase tracking-wider">
            {[['all', t('tx_all', 'Semua')], ['income', t('tx_income', 'Pemasukan')], ['expense', t('tx_expense', 'Pengeluaran')], ['asset', t('my_assets', 'Aset/Transfer')]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setLocalTxFilter(v)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition whitespace-nowrap ${localTxFilter === v ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {displayList.length === 0 ? (
          <div className="py-20 text-center">
            <EmptyState message={`Tidak ada transaksi pada filter periode ini.`} actions={[]} />
          </div>
        ) : (
          <DataTable 
            columns={[
              { label: 'Tanggal' },
              { label: 'Tipe & Kategori' },
              { label: 'Keterangan' },
              { label: 'Akun' },
              { label: 'Nominal', align: 'right' }
            ]}
            data={displayList}
            onEdit={onEdit}
            onDelete={onDelete}
            renderDesktopRow={(tx) => {
              let typeBadgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
              let typeLabel = tx.type;
              if (tx.type === 'income') { typeBadgeClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"; typeLabel = t("tx_income", "Pemasukan"); }
              if (tx.type === 'expense') { typeBadgeClass = "bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400"; typeLabel = t("tx_expense", "Pengeluaran"); }
              if (tx.type === 'transfer' && tx.category === 'Piutang') { typeBadgeClass = "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"; typeLabel = t("receivable_label", "Piutang"); }
              if (tx.type === 'debt') { typeBadgeClass = "bg-rose-50 border border-rose-100 text-rose-600 dark:border-rose-900/30"; typeLabel = t("debt_label", "Utang"); }
              if (tx.type === 'asset' || tx.category === 'Settlement') { typeBadgeClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/20"; typeLabel = t("my_assets", "Aset"); }

              const isIncome = tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false);
              const isAsset = tx.type === 'asset' || tx.type === 'transfer' || tx.type === 'debt';

              const sourceAcc = accMap[tx.accountId]?.name || 'Akun Terhapus';
              const targetAcc = tx.targetAccountId ? (accMap[tx.targetAccountId]?.name || 'Akun Terhapus') : null;
              const accText = targetAcc ? `${sourceAcc} → ${targetAcc}` : sourceAcc;

              return (
                <>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap font-medium">{tx.date}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${typeBadgeClass}`}>{typeLabel}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">{tx.category || '-'}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400 text-xs max-w-[200px]">
                    <div className="line-clamp-2 leading-relaxed font-medium">{tx.note || '—'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-block rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {accText}
                    </span>
                  </td>
                  <td className={`px-5 py-4 text-right font-black text-sm whitespace-nowrap tabular-nums ${isIncome ? 'text-emerald-600 dark:text-emerald-500' : isAsset ? 'text-slate-600 dark:text-slate-400' : 'text-rose-600 dark:text-rose-500'}`}>
                    {isIncome ? '+' : '-'}{displayIDR(tx.amount, privacyMode)}
                  </td>
                </>
              )
            }}
            renderMobileCard={(tx) => {
              let typeLabel = tx.type;
              if (tx.type === 'income') typeLabel = t("tx_income", "Pemasukan");
              if (tx.type === 'expense') typeLabel = t("tx_expense", "Pengeluaran");
              if (tx.type === 'transfer' && tx.category === 'Piutang') typeLabel = t("receivable_label", "Piutang");
              if (tx.type === 'debt') typeLabel = t("debt_label", "Utang");
              if (tx.type === 'asset' || tx.category === 'Settlement') typeLabel = t("my_assets", "Aset");

              const isIncome = tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false);
              const isAsset = tx.type === 'asset' || tx.type === 'transfer' || tx.type === 'debt';

              const sourceAcc = accMap[tx.accountId]?.name || 'Akun Terhapus';
              const targetAcc = tx.targetAccountId ? (accMap[tx.targetAccountId]?.name || 'Akun Terhapus') : null;
              const accText = targetAcc ? `${sourceAcc} → ${targetAcc}` : sourceAcc;

              return (
                <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate mb-0.5">{tx.category || typeLabel}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                      {tx.note ? <span className="truncate">{tx.note}</span> : ''}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[9px] font-bold text-slate-400 uppercase">{tx.date}</span>
                       <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{accText}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`font-black text-sm tabular-nums ${isIncome ? 'text-emerald-600 dark:text-emerald-500' : isAsset ? 'text-slate-500 dark:text-slate-400' : 'text-rose-600 dark:text-rose-500'}`}>
                      {isIncome ? '+' : '-'}{displayIDR(tx.amount, privacyMode)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(tx); }} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }} className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            }}
          />
        )}
      </div>
    </section>
  )
})
