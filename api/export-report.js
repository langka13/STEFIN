import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit-table';
import { fetchWithKeyRotation } from './keyRotation.js';

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

async function getAIAnalysis(userName, monthLabel, stats) {
  const prompt = `Anda adalah konsultan keuangan pribadi SteFin AI.
Berikan analisis singkat untuk ${userName} bulan ${monthLabel}.

Data:
- Pemasukan: ${fmt(stats.income)}
- Pengeluaran: ${fmt(stats.expense)}
- Sisa: ${fmt(stats.income - stats.expense)}

Format (HTML sederhana: <b>, <p>, <ul>):
1. Status Keuangan (Sehat/Waspada/Kritis)
2. Insight utama (1 poin)
3. Saran praktis (1 poin)

Gunakan bahasa motivatif dan singkat.`;

  try {
    const { data } = await fetchWithKeyRotation((key) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      payload: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500 },
      },
    }));
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.replace(/```html/g, '').replace(/```/g, '');
  } catch (e) {
    console.error('AI Analysis error:', e.message);
    return `<i>Analisis AI tidak tersedia: ${e.message}</i>`;
  }
}

function generatePDFBuffer(userName, targetMonthLabel, monthStats, globalStats, transactions) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => { resolve(Buffer.concat(buffers)); });

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('SteFin', { continued: true }).fillColor('#10b981').text('Statement', { align: 'left' });
    doc.moveUp();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text('LAPORAN KEUANGAN PRIBADI', { align: 'right' });
    doc.font('Helvetica').fontSize(9).text(`Periode: ${targetMonthLabel}`, { align: 'right' });
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Dipersiapkan untuk:`, { continued: true }).font('Helvetica').text(` ${userName}`);
    doc.moveDown(1.5);

    doc.rect(40, doc.y, 515, 75).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#0f172a');
    let boxY = doc.y + 10;
    doc.font('Helvetica-Bold').fontSize(10).text('POSISI KEUANGAN SAAT INI', 55, boxY);
    boxY += 20;
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Kekayaan Bersih (Net Worth)', 55, boxY);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(globalStats.netWorth >= 0 ? '#10b981' : '#ef4444').text(`${fmt(globalStats.netWorth)}`, 55, boxY + 12);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Saldo Kas Bebas', 220, boxY);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`${fmt(globalStats.totalBalance)}`, 220, boxY + 14);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Aset & Piutang', 350, boxY);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`${fmt(globalStats.assets)}`, 350, boxY + 14);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Total Utang', 460, boxY);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#ef4444').text(`${fmt(globalStats.debts)}`, 460, boxY + 14);
    doc.moveDown(3);

    const net = monthStats.income - monthStats.expense;
    const savingsRate = monthStats.income > 0 ? Math.round((net / monthStats.income) * 100) : 0;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Ringkasan Arus Kas Bulan Ini`, 40);
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total Pemasukan`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#10b981').text(`${fmt(monthStats.income)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Total Pengeluaran`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#ef4444').text(`${fmt(monthStats.expense)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Net Savings`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor(net >= 0 ? '#10b981' : '#ef4444').text(`${fmt(net)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Savings Rate`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${savingsRate}%`, { align: 'right' });
    doc.moveDown(2);

    doc.table({
      headers: ['Tanggal', 'Kategori', 'Tipe', 'Catatan', 'Nominal'],
      rows: transactions.map(tx => [
        tx.date || '-',
        tx.level1 || tx.category || '-',
        tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : tx.type === 'asset' ? 'Aset' : tx.type === 'debt' ? 'Utang' : 'Transfer',
        tx.note || '-',
        fmt(tx.amount || 0)
      ])
    }, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a'),
      prepareRow: () => doc.font('Helvetica').fontSize(8).fillColor('#334155')
    });

    doc.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  const { uid, email, userName, targetMonth, targetMonthLabel } = req.body;
  if (!uid || !email) return res.status(400).json({ error: 'Missing parameters' });

  try {
    if (!admin.apps.length) {
      const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(jsonStr)) });
    }
    const db = admin.firestore();

    const accSnapshot = await db.collection('users').doc(uid).collection('accounts').get();
    const accounts = accSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const allTxSnapshot = await db.collection('users').doc(uid).collection('transactions').get();
    const allTransactions = allTxSnapshot.docs.map(d => d.data());

    let totalBalance = 0;
    accounts.forEach(acc => {
      let cb = acc.balance || 0;
      allTransactions.forEach(tx => {
        if (tx.accountId === acc.id) {
          if (tx.type === 'income') cb += tx.amount;
          if (tx.type === 'expense') cb -= tx.amount;
          if (tx.type === 'debt') cb += (tx.category === 'Pelunasan' ? -tx.amount : (tx.isInitial ? 0 : tx.amount));
          if (tx.type === 'transfer') {
            if (tx.category === 'Piutang') { if (!tx.isInitial) cb -= tx.amount; }
            else cb -= tx.amount;
          }
          if (tx.type === 'asset') cb += (tx.category === 'Settlement' ? tx.amount : (tx.isInitial ? 0 : -tx.amount));
        }
        if (tx.targetAccountId === acc.id && tx.type === 'transfer') cb += tx.amount;
      });
      totalBalance += cb;
    });

    const assetPlus = allTransactions.filter(t => t.type === 'asset' && t.category !== 'Settlement').reduce((s, t) => s + t.amount, 0);
    const assetMinus = allTransactions.filter(t => t.type === 'asset' && t.category === 'Settlement').reduce((s, t) => s + t.amount, 0);
    const receivables = allTransactions.filter(t => t.type === 'transfer' && t.category === 'Piutang').reduce((s, t) => s + t.amount, 0);
    const debts = allTransactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan').reduce((s, t) => s + t.amount, 0);
    const totalAssets = assetPlus + receivables - assetMinus;
    const globalStats = { totalBalance, assets: totalAssets, debts, netWorth: totalBalance + totalAssets - debts };

    let income = 0, expense = 0;
    const monthTxList = allTransactions.filter(tx => tx.date?.startsWith(targetMonth)).sort((a, b) => new Date(a.date) - new Date(b.date));
    monthTxList.forEach(tx => {
      if (tx.type === 'income') income += tx.amount || 0;
      if (tx.type === 'expense') expense += tx.amount || 0;
    });

    const aiAnalysis = await getAIAnalysis(userName, targetMonthLabel, { income, expense });
    const pdfBuffer = await generatePDFBuffer(userName, targetMonthLabel, { income, expense }, globalStats, monthTxList);

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });
    await transporter.sendMail({
      from: `"SteFin AI" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Laporan Keuangan & Analisis AI - ${targetMonthLabel}`,
      html: `<div style="font-family:Arial;color:#333;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#10B981;color:white;padding:24px;text-align:center;"><h2 style="margin:0;">Laporan SteFin</h2><p style="margin:5px 0 0;opacity:.9;">${targetMonthLabel}</p></div>
        <div style="padding:32px;">
          <p>Halo <strong>${userName}</strong>, laporan keuangan Anda sudah siap.</p>
          <div style="background:#f8fafc;border-left:4px solid #10B981;padding:16px;margin:20px 0;font-size:14px;line-height:1.6;">
            <strong style="color:#10B981;font-size:12px;text-transform:uppercase;">SteFin AI Analysis</strong><br/>${aiAnalysis}
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:24px;">
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px 0;color:#64748b;">Total Pemasukan</td><td style="text-align:right;color:#10B981;font-weight:bold;">${fmt(income)}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px 0;color:#64748b;">Total Pengeluaran</td><td style="text-align:right;color:#EF4444;font-weight:bold;">${fmt(expense)}</td></tr>
            <tr><td style="padding:12px 0;font-weight:bold;">Net Savings</td><td style="text-align:right;font-weight:bold;color:${(income-expense)>=0?'#10B981':'#EF4444'};">${fmt(income-expense)}</td></tr>
          </table>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;">&copy; SteFin Assistant.</div>
      </div>`,
      attachments: [{ filename: `SteFin_Report_${targetMonth}.pdf`, content: pdfBuffer }]
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('EXPORT ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}
