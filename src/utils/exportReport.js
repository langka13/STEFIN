import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatIDR } from './constants';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportToPDF = (transactions, summary, dateRangeStr, aiReport, netWorthData, totalBalance, allTx, accounts, user, t) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Use "times" which is closest to "Palatino" in standard jsPDF fonts
  const fontFam = "times";

  // --- FOOTER FUNCTION ---
  const addFooter = () => {
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(fontFam, "italic");
      doc.setTextColor(150, 150, 150);
      const text = 'Laporan keuangan ini dibuat secara otomatis oleh Aplikasi SteFin.';
      const textWidth = doc.getStringUnitWidth(text) * 8 / doc.internal.scaleFactor;
      doc.text(text, (pageWidth - textWidth) / 2, pageHeight - 10);
    }
  };

  // ─── HELPER MENGHITUNG PIUTANG & UTANG DARI ALL TX ───
  // Mirip dengan logic di FinancialContext
  const piutangKeyMap = {};
  const piutangGroups = {};
  const utangKeyMap = {};
  const utangGroups = {};

  const isPiutang = (tx) => tx.type === 'transfer' && (tx.category === 'Piutang Personal' || tx.category === 'Piutang Usaha' || tx.category === 'Piutang');
  const isDebt = (tx) => tx.type === 'debt' && tx.category !== 'Pelunasan';
  const isSettlement = (tx) => tx.type === 'asset' && tx.category === 'Settlement';
  const isDebtPayment = (tx) => tx.type === 'debt' && tx.category === 'Pelunasan';
  const isAsset = (tx) => tx.type === 'asset' && tx.category !== 'Settlement';

  (allTx || []).forEach(tx => {
    if (isPiutang(tx)) {
      const key = (tx.note || tx.category || 'Lainnya').trim();
      piutangKeyMap[tx.id] = key;
      if (!piutangGroups[key]) piutangGroups[key] = { nominal: 0, paid: 0 };
      piutangGroups[key].nominal += tx.amount;
    }
    if (isDebt(tx)) {
      const key = (tx.note || tx.category || 'Lainnya').trim();
      utangKeyMap[tx.id] = key;
      if (!utangGroups[key]) utangGroups[key] = { nominal: 0, paid: 0 };
      utangGroups[key].nominal += tx.amount;
    }
  });

  (allTx || []).forEach(tx => {
    if (isSettlement(tx) && tx.settledPiutangId) {
      const key = piutangKeyMap[tx.settledPiutangId];
      if (key && piutangGroups[key]) piutangGroups[key].paid += tx.amount;
    }
    if (isDebtPayment(tx) && tx.settledDebtId) {
      const key = utangKeyMap[tx.settledDebtId];
      if (key && utangGroups[key]) utangGroups[key].paid += tx.amount;
    }
  });

  const activePiutang = Object.entries(piutangGroups).map(([k, v]) => ({ name: k, sisa: Math.max(0, v.nominal - v.paid) })).filter(x => x.sisa > 0);
  const activeUtang = Object.entries(utangGroups).map(([k, v]) => ({ name: k, sisa: Math.max(0, v.nominal - v.paid) })).filter(x => x.sisa > 0);
  const assetsList = (allTx || []).filter(tx => isAsset(tx));

  // --- CALCULATION VARIABLES ---
  const mIncome = summary.income || 0;
  const mExpense = summary.expense || 0;
  const saldoKas = totalBalance || 0;
  const netWorth = (netWorthData && netWorthData.netWorth) || 0;
  const totalAset = assetsList.reduce((sum, a) => sum + a.amount, 0);
  const sisaPiutangTotal = activePiutang.reduce((sum, p) => sum + p.sisa, 0);
  const sisaUtangTotal = activeUtang.reduce((sum, u) => sum + u.sisa, 0);
  
  const savingsRate = mIncome > 0 ? Math.round(((mIncome - mExpense) / mIncome) * 100) : 0;
  const rasioUtang = saldoKas > 0 ? Math.round((sisaUtangTotal / saldoKas) * 100) : (sisaUtangTotal > 0 ? 999 : 0);

  const formatShort = (num) => {
    if (num >= 1e9) return (num/1e9).toFixed(1) + ' M';
    if (num >= 1e6) return (num/1e6).toFixed(1) + ' Jt';
    if (num >= 1e3) return (num/1e3).toFixed(1) + ' Rb';
    return formatIDR(num);
  }

  // ============================================================================
  // HALAMAN 1: INFOGRAFIS UTAMA (VISUAL DASHBOARD MENGGUNAKAN KONSEP KOTAK/CARD)
  // ============================================================================
  
  // 1. HEADER (BACKGROUND WARNA BIRU GELAP)
  doc.setFillColor(17, 17, 17); // brand slate-950
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(22);
  doc.text('LAPORAN KINERJA KEUANGAN', 16, 22);
  
  doc.setFont(fontFam, "normal");
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 200);
  doc.text(`Periode Laporan: ${dateRangeStr}`, 16, 32);

  if (user) {
    const userName = user.displayName || user.name || 'User Name';
    const userEmail = user.email || '';
    
    doc.setFont(fontFam, "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(userName, pageWidth - 16, 22, { align: 'right' });
    
    doc.setFont(fontFam, "italic");
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(userEmail, pageWidth - 16, 30, { align: 'right' });
  }

  let startY = 55;

  // 2. 4 KOTAK METRIK UTAMA (SEJAJAR HORIZONTAL)
  const cardW = 41.5;
  const cardH = 28;
  const gap = 5;
  
  const drawMetricCard = (x, y, w, h, bgArr, title, valStr, valColorArr) => {
    doc.setFillColor(...bgArr);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setFont(fontFam, "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(title, x + 4, y + 9);
    doc.setFont(fontFam, "bold");
    doc.setFontSize(12);
    doc.setTextColor(...valColorArr);
    doc.text(valStr, x + 4, y + 19);
  };

  drawMetricCard(16, startY, cardW, cardH, [246, 255, 234], 'Pemasukan (In)', formatShort(mIncome), [103, 184, 0]); // emerald
  drawMetricCard(16 + cardW + gap, startY, cardW, cardH, [255, 241, 242], 'Pengeluaran (Out)', formatShort(mExpense), [190, 18, 60]); // rose
  drawMetricCard(16 + (cardW + gap)*2, startY, cardW, cardH, [239, 246, 255], 'Saldo Kas Liquid', formatShort(saldoKas), [29, 78, 216]); // blue
  drawMetricCard(16 + (cardW + gap)*3, startY, cardW, cardH, [238, 238, 238], 'Net Worth / Kekayaan', formatShort(netWorth), [34, 34, 34]); // slate

  startY += cardH + 12;

  // 3. 2 PANEL BESAR SEJAJAR (INDIKATOR KESEHATAN vs RINCIAN ASET/UTANG)
  const panelW = 86;
  const panelH = 100;
  const panelX1 = 16;
  const panelX2 = 16 + panelW + gap + 3;

  // Background Panel
  doc.setFillColor(247, 247, 247);
  doc.setDrawColor(187, 187, 187);
  doc.setLineWidth(0.3);
  doc.roundedRect(panelX1, startY, panelW, panelH, 2, 2, 'FD');
  doc.roundedRect(panelX2, startY, panelW, panelH, 2, 2, 'FD');

  // --- PANEL KIRI: Indikator Perekonomian & Kesehatan ---
  doc.setFont(fontFam, "bold");
  doc.setFontSize(12);
  doc.setTextColor(34, 34, 34);
  doc.text('Indikator Perekonomian & Kesehatan', panelX1 + 5, startY + 8);
  doc.line(panelX1 + 5, startY + 11, panelX1 + panelW - 5, startY + 11);

  // Bagian 1 Kiri: Rasio Tabungan
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  doc.text('Rasio Tabungan', panelX1 + 5, startY + 22);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(20);
  doc.setTextColor( savingsRate >= 20 ? 103 : (savingsRate > 0 ? 202 : 225), 
                    savingsRate >= 20 ? 184 : (savingsRate > 5 ? 138 : 29), 
                    savingsRate >= 20 ? 0 : (savingsRate > 5 ? 4 : 29) );
  doc.text(`${Math.max(0, savingsRate)}%`, panelX1 + 5, startY + 31);
  doc.setFont(fontFam, "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(savingsRate >= 20 ? 'Ideal (>20%)' : (savingsRate > 0 ? 'Kurang Ideal' : 'Defisit'), panelX1 + panelW - 22, startY + 31);

  // Bagian 2 Kiri: Rasio Utang vs Kas
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  doc.text('Rasio Utang terhadap Kas', panelX1 + 5, startY + 45);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(20);
  doc.setTextColor(rasioUtang <= 30 ? 103 : (rasioUtang <= 100 ? 202 : 225),
                   rasioUtang <= 30 ? 184 : (rasioUtang <= 100 ? 138 : 29),
                   rasioUtang <= 30 ? 0 : (rasioUtang <= 100 ? 4 : 29));
  doc.text(`${rasioUtang}%`, panelX1 + 5, startY + 54);
  doc.setFont(fontFam, "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(rasioUtang <= 30 ? 'Aman (<30%)' : (rasioUtang <= 100 ? 'Hati-hati' : 'Bahaya'), panelX1 + panelW - 22, startY + 54);

  // Bagian 3 Kiri: Dana Darurat Progress
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  doc.text('Target Dana Darurat', panelX1 + 5, startY + 68);
  const avgExpense = Math.max(mExpense, 2000000); 
  const emergencyTarget = avgExpense * 6;
  doc.setFont(fontFam, "normal");
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text(`Terkumpul: ${formatShort(saldoKas)} / Target: ${formatShort(emergencyTarget)}`, panelX1 + 5, startY + 74);
  let progress = Math.min(100, Math.round((saldoKas/emergencyTarget)*100));
  doc.setFillColor(238, 238, 238); // bg bar
  doc.roundedRect(panelX1 + 5, startY + 77, panelW - 10, 5, 2, 2, 'F');
  doc.setFillColor(137, 233, 0); // brand lime
  if(progress > 0) doc.roundedRect(panelX1 + 5, startY + 77, ((panelW - 10) * progress / 100), 5, 2, 2, 'F');
  doc.setFont(fontFam, "bold");
  doc.setFontSize(7);
  doc.setTextColor(34, 34, 34);
  doc.text(`${progress}% Selesai`, panelX1 + 5, startY + 87);


  // --- PANEL KANAN: Portofolio & Posisi Keuangan Terkini ---
  doc.setFont(fontFam, "bold");
  doc.setFontSize(12);
  doc.setTextColor(34, 34, 34);
  doc.text('Portofolio & Posisi Transaksional', panelX2 + 5, startY + 8);
  doc.line(panelX2 + 5, startY + 11, panelX2 + panelW - 5, startY + 11);

  // Bagian 1 Kanan: Posisi Aset
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  doc.text('Aset Investasi & Simpanan', panelX2 + 5, startY + 22);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(16);
  doc.setTextColor(103, 184, 0); // emerald-700
  doc.text(formatIDR(totalAset), panelX2 + 5, startY + 30);

  // Bagian 2 Kanan: Piutang
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  doc.text('Total Piutang Berjalan (Uang di Orang)', panelX2 + 5, startY + 45);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(16);
  doc.setTextColor(202, 138, 4);
  doc.text(formatIDR(sisaPiutangTotal), panelX2 + 5, startY + 53);

  // Bagian 3 Kanan: Utang
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  doc.text('Total Kewajiban Utang Belum Lunas', panelX2 + 5, startY + 68);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(16);
  doc.setTextColor(225, 29, 29);
  doc.text(formatIDR(sisaUtangTotal), panelX2 + 5, startY + 76);

  startY += panelH + 12;

  // 4. KOTAK REKOMENDASI BAWAH
  doc.setFillColor(247, 247, 247);
  doc.setDrawColor(187, 187, 187);
  doc.roundedRect(16, startY, 210 - 32, 50, 2, 2, 'FD');
  doc.setFont(fontFam, "bold");
  doc.setFontSize(12);
  doc.setTextColor(34, 34, 34);
  doc.text('Catatan & Rekomendasi Finansial', 22, startY + 9);
  
  doc.setFont(fontFam, "normal");
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  if (aiReport) {
    const wrappedText = doc.splitTextToSize(aiReport, 210 - 45);
    doc.text(wrappedText, 22, startY + 16);
  } else {
    let recY = startY + 18;
    // Default smart recommendations
    if (savingsRate < 20) {
      doc.text('• Evaluasi kembali pengeluaran bulan ini. Menabung idealnya minimal 20% dari pemasukan.', 22, recY); recY += 6;
    } else {
      doc.text('• Pertahankan rasio tabungan bulan ini. Anda telah menyisihkan lebih dari 20% penghasilan.', 22, recY); recY += 6;
    }

    if (rasioUtang > 50) {
      doc.text('• Prioritaskan pelunasan utang yang membebani, porsi utang Anda terhadap kas saat ini cukup tinggi.', 22, recY); recY += 6;
    } else if (sisaPiutangTotal > saldoKas) {
      doc.text('• Pertimbangkan untuk mulai menagih dana piutang Anda untuk memperbesar rasio kas liquid Anda.', 22, recY); recY += 6;
    }

    if (progress < 100) {
      doc.text('• Terus tingkatkan dana darurat setidaknya sampai 6x dari pengeluaran rutin Anda.', 22, recY); recY += 6;
    } else {
      doc.text('• Fasilitas Dana Darurat Anda telah tercapai. Dana lebih dapat dialokasikan untuk instrumen investasi.', 22, recY); recY += 6;
    }
  }

  // ============================================================================
  // HALAMAN 2+: TABEL RINCIAN TRANSAKSIONAL DAN DAFTAR
  // ============================================================================
  doc.addPage();
  let tableY = 20;

  // Title page 2
  doc.setTextColor(34, 34, 34);
  doc.setFont(fontFam, "bold");
  doc.setFontSize(18);
  doc.text('Lampiran Rincian Data Keuangan', 16, tableY);
  tableY += 10;

  // TABEL 1: DAFTAR ASET, PIUTANG DAN UTANG
  const assetBody = assetsList.map(a => [a.date, a.note || a.category, formatIDR(a.amount)]);
  const piutangBody = activePiutang.map(p => [p.name, formatIDR(p.sisa)]);
  const utangBody = activeUtang.map(u => [u.name, formatIDR(u.sisa)]);

  if (assetBody.length > 0) {
    autoTable(doc, {
      startY: tableY,
      head: [['Tanggal Beli', 'Daftar Aset Aktif', 'Nilai Aset']],
      body: assetBody,
      theme: 'grid',
      styles: { font: fontFam, fontSize: 10, textColor: [51, 51, 51], lineColor: [187, 187, 187] },
      headStyles: { fillColor: [137, 233, 0], textColor: [17, 17, 17], font: fontFam, fontStyle: 'bold' } // brand-lime
    });
    tableY = doc.lastAutoTable.finalY + 10;
  }

  if (piutangBody.length > 0) {
    autoTable(doc, {
      startY: tableY,
      head: [['Nama Pihak/Catatan Piutang', 'Sisa Uang di Pihak Lain']],
      body: piutangBody,
      theme: 'grid',
      styles: { font: fontFam, fontSize: 10, textColor: [51, 51, 51], lineColor: [187, 187, 187] },
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], font: fontFam, fontStyle: 'bold' } // amber-600
    });
    tableY = doc.lastAutoTable.finalY + 10;
  }

  if (utangBody.length > 0) {
    autoTable(doc, {
      startY: tableY,
      head: [['Nama Pihak/Catatan Utang Kredit', 'Sisa Kewajiban Bayar']],
      body: utangBody,
      theme: 'grid',
      styles: { font: fontFam, fontSize: 10, textColor: [51, 51, 51], lineColor: [187, 187, 187] },
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], font: fontFam, fontStyle: 'bold' } // rose-600
    });
    tableY = doc.lastAutoTable.finalY + 10;
  }

  // TABEL 2: ARUS KAS LENGKAP KATEGORI
  if (tableY > pageHeight - 60) { doc.addPage(); tableY = 20; }
  autoTable(doc, {
    startY: tableY,
    head: [['Ringkasan Arus Kas Kategori', 'Nominal']],
    body: [
      ['Total Pemasukan', formatIDR(summary.income)],
      ['Total Pengeluaran Laba Rugi', formatIDR(summary.expense)],
      ['Pembelian Aset', formatIDR(summary.assetOut)],
      ['Pemberian Piutang Baru', formatIDR(summary.piutangOut)],
      ['Penerimaan Piutang (Pelunasan diproses)', formatIDR(summary.piutangIn)],
      ['Penerimaan Utang Baru', formatIDR(summary.debtIn)],
      ['Pembayaran Utang (Pelunasan)', formatIDR(summary.debtOut)],
      ['Net Cashflow Arus Kas', formatIDR(summary.netCashflow)],
    ],
    theme: 'grid',
    styles: { font: fontFam, fontSize: 10, textColor: [51, 51, 51], lineColor: [187, 187, 187] },
    headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], font: fontFam, fontStyle: 'bold' } // slate-950
  });
  tableY = doc.lastAutoTable.finalY + 10;


  // TABEL 3: JURNAL UMUM (TRANSAKSI BULAN/PERIODE)
  if (tableY > pageHeight - 60) { doc.addPage(); tableY = 20; }
  doc.setFont(fontFam, "bold");
  doc.setFontSize(14);
  doc.setTextColor(34, 34, 34);
  doc.text('Buku Jurnal Umum (Aktivitas Transaksi)', 16, tableY);
  tableY += 6;

  const txBody = transactions.map(tx => {
    let typeLabel = tx.type;
    if (tx.type === 'income') typeLabel = 'Pemasukan';
    if (tx.type === 'expense') typeLabel = 'Pengeluaran';
    
    return [
      tx.date,
      typeLabel,
      tx.category,
      tx.note,
      tx.type === 'income' || tx.type === 'debt' || (tx.type === 'asset' && tx.category === 'Settlement') || (tx.type === 'transfer' && tx.category === 'Pelunasan') 
        ? formatIDR(tx.amount) : '-',
      tx.type === 'expense' || (tx.type === 'asset' && tx.category !== 'Settlement') || (tx.type === 'debt' && tx.category === 'Pelunasan') || (tx.type === 'transfer' && tx.category !== 'Pelunasan')
        ? formatIDR(tx.amount) : '-'
    ];
  });

  autoTable(doc, {
    startY: tableY,
    head: [['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Dana Masuk', 'Dana Keluar']],
    body: txBody,
    theme: 'striped',
    styles: { font: fontFam, fontSize: 9, textColor: [51, 51, 51], lineColor: [238, 238, 238] },
    headStyles: { fillColor: [17, 17, 17], textColor: [137, 233, 0], font: fontFam, fontStyle: 'bold' } // dark slate header with brand-lime text
  });

  addFooter();
  doc.save(`Laporan_Keuangan_SteFin_${dateRangeStr.replace(/ /g, '_')}.pdf`);
};

export const exportToExcel = async (transactions, summary, dateRangeStr) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SteFin App';
  workbook.lastModifiedBy = 'SteFin App';
  workbook.created = new Date();
  workbook.modified = new Date();

  // --- SHEET 1: RINGKASAN KEUANGAN ---
  const wsSummary = workbook.addWorksheet('Ringkasan Keuangan', {
    views: [{ showGridLines: false }],
    properties: { defaultColWidth: 20 }
  });

  wsSummary.getColumn(1).width = 4;
  wsSummary.getColumn(2).width = 45;
  wsSummary.getColumn(3).width = 25;

  // Title Row
  const titleRow = wsSummary.getRow(2);
  titleRow.getCell(2).value = 'LAPORAN KINERJA KEUANGAN STEFIN';
  titleRow.getCell(2).font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
  titleRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
  
  const periodRow = wsSummary.getRow(3);
  periodRow.getCell(2).value = `Periode: ${dateRangeStr}`;
  periodRow.getCell(2).font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FFEEEEEE' } };
  periodRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
  periodRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
  
  wsSummary.mergeCells('B2:C2');
  wsSummary.mergeCells('B3:C3');
  titleRow.height = 30;
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  periodRow.height = 20;
  periodRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Gap
  wsSummary.getRow(4).height = 10;

  // Ringkasan Section Header
  const headRow = wsSummary.getRow(5);
  headRow.getCell(2).value = 'KETERANGAN ARUS KAS';
  headRow.getCell(3).value = 'NOMINAL (IDR)';
  ['B', 'C'].forEach(col => {
    const cell = headRow.getCell(col);
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FF111111' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF89E900' } }; // Brand Lime
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF111111' } },
      bottom: { style: 'medium', color: { argb: 'FF111111' } }
    };
  });
  headRow.height = 25;

  const dataRows = [
    ['Total Pemasukan', summary.income, 'FF222222', 'FFECFDC9'], // bg-emerald-100
    ['Total Pengeluaran (Laba Rugi)', summary.expense, 'FF222222', 'FFFFE4E6'], // bg-rose-100
    ['Pembelian Aset', summary.assetOut, 'FF444444', null],
    ['Pemberian Piutang Baru', summary.piutangOut, 'FF444444', null],
    ['Penerimaan Piutang (Pelunasan)', summary.piutangIn, 'FF444444', null],
    ['Penerimaan Utang Baru', summary.debtIn, 'FF444444', null],
    ['Pembayaran Utang (Pelunasan)', summary.debtOut, 'FF444444', null],
  ];

  let currRow = 6;
  dataRows.forEach(([label, val, txtColor, bgColor]) => {
    const r = wsSummary.getRow(currRow);
    r.getCell(2).value = label;
    r.getCell(2).font = { name: 'Arial', color: { argb: txtColor } };
    r.getCell(3).value = val;
    r.getCell(3).numFmt = '"Rp" #,##0.00;[Red]"Rp" -#,##0.00';
    r.getCell(3).font = { name: 'Arial', color: { argb: txtColor }, bold: bgColor ? true : false };
    
    if (bgColor) {
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    }
    
    // borders
    ['B', 'C'].forEach(col => {
      r.getCell(col).border = {
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
    });
    r.height = 20;
    r.alignment = { vertical: 'middle' };
    currRow++;
  });

  // Net Cashflow
  const netRow = wsSummary.getRow(currRow);
  netRow.getCell(2).value = 'NET CASHFLOW (Surplus/Defisit)';
  netRow.getCell(3).value = summary.netCashflow;
  ['B', 'C'].forEach(col => {
    const cell = netRow.getCell(col);
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }; // Slate-950
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF111111' } },
      bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
    };
    if (col === 'C') cell.numFmt = '"Rp" #,##0.00;[Red]"Rp" -#,##0.00';
    cell.alignment = { vertical: 'middle' };
  });
  netRow.height = 25;


  // --- SHEET 2: JURNAL UMUM ---
  const wsTx = workbook.addWorksheet('Jurnal Umum', {
    views: [{ showGridLines: false }]
  });

  wsTx.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Tanggal', key: 'date', width: 14 },
    { header: 'Tipe', key: 'type', width: 18 },
    { header: 'Kategori', key: 'kategori', width: 25 },
    { header: 'Keterangan', key: 'note', width: 45 },
    { header: 'Debit (Masuk)', key: 'debit', width: 22 },
    { header: 'Kredit (Keluar)', key: 'kredit', width: 22 }
  ];

  // Style the Header
  wsTx.getRow(1).height = 25;
  wsTx.getRow(1).eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FF111111' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF89E900' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF111111' } } };
  });

  // Add Data
  let rowIndex = 2;
  transactions.forEach((tx, idx) => {
    let typeLabel = tx.type;
    if (tx.type === 'income') typeLabel = 'Pemasukan';
    if (tx.type === 'expense') typeLabel = 'Pengeluaran';
    if (tx.type === 'transfer' && tx.category === 'Piutang') typeLabel = 'Piutang';
    if (tx.type === 'debt') typeLabel = 'Utang';
    if (tx.type === 'asset' || tx.category === 'Settlement') typeLabel = 'Aset';

    const isCredit = tx.type === 'income' || tx.category === 'Settlement' || (tx.type === 'debt' && tx.category !== 'Pelunasan' && tx.isInitial === false);
    
    const row = wsTx.addRow({
      no: idx + 1,
      date: tx.date,
      type: typeLabel,
      kategori: tx.category || '-',
      note: tx.note || '-',
      debit: isCredit ? tx.amount : '',
      kredit: !isCredit ? tx.amount : ''
    });

    // Formatting based on type
    const isIncome = isCredit;
    const isExpense = !isCredit && tx.type === 'expense';
    
    row.eachCell((cell, colNumber) => {
      // Alternating striping for readability
      if (rowIndex % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
      
      // Border
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } }
      };

      // Alignment
      cell.alignment = { vertical: 'middle' };
      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Money formatting
      if (colNumber === 6 || colNumber === 7) {
        cell.numFmt = '"Rp" #,##0.00;[Red]"Rp" -#,##0.00';
        if (cell.value) {
           if (colNumber === 6) cell.font = { color: { argb: 'FF67B800' } }; // green for debit
           if (colNumber === 7) cell.font = { color: { argb: 'FFE11D48' } }; // red for credit
        }
      }
    });
    row.height = 20;
    rowIndex++;
  });

  // Freeze top row 
  wsTx.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
  ];

  // Save via ExcelJS and FileSaver
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Laporan_Keuangan_SteFin_${dateRangeStr.replace(/ /g, '_')}.xlsx`);
};
