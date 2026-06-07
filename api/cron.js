import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit-table';

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

async function getAIAnalysis(userName, monthLabel, stats) {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return null;

  const prompt = `SteFin AI. Review ${userName} (${monthLabel}): In:${fmt(stats.income)} Out:${fmt(stats.expense)}. Berikan Analisis Keuangan Expert (HTML): 1.Kesehatan(1-10) 2.Insight 3.Action Plan. Singkat & Padat. No sapaan.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 500 } })
    });
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.replace(/```html/g, '').replace(/```/g, '').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  } catch (e) { return null; }
}

function generatePDFBuffer(userName, targetMonthLabel, monthStats, globalStats, transactions) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => { resolve(Buffer.concat(buffers)); });

    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('SteFin', { continued: true }).fillColor('#10b981').text('Statement');
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
    doc.font('Helvetica-Bold').fontSize(12).text(`Ringkasan Arus Kas Bulan Ini`, 40);
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10).text(`Total Pemasukan`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#10b981').text(`${fmt(monthStats.income)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Total Pengeluaran`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#ef4444').text(`${fmt(monthStats.expense)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Net Savings`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor(net >= 0 ? '#10b981' : '#ef4444').text(`${fmt(net)}`, { align: 'right' });

    doc.moveDown(2);
    doc.table({
      headers: ['Tanggal', 'Kategori', 'Tipe', 'Catatan', 'Nominal'],
      rows: transactions.map(tx => [tx.date || '-', tx.level1 || tx.category || '-', tx.type, tx.note || '-', fmt(tx.amount || 0)])
    }, { prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9), prepareRow: () => doc.font('Helvetica').fontSize(8) });

    doc.end();
  });
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) return res.status(401).end();
  try {
    if (!admin.apps.length) {
      const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(jsonStr)) });
    }
    const db = admin.firestore();
    const usersSnapshot = await db.collection('users').get();
    const targetMonth = new Date().toISOString().slice(0, 7);
    const targetMonthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;
      if (!userData.email) continue;

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
             if (tx.type === 'transfer') cb -= tx.amount;
             if (tx.type === 'asset') cb += (tx.category === 'Settlement' ? tx.amount : -tx.amount);
           }
           if (tx.targetAccountId === acc.id) cb += tx.amount;
        });
        totalBalance += cb;
      });

      const assetPlus = allTransactions.filter(t => t.type === 'asset' && t.category !== 'Settlement').reduce((sum, t) => sum + t.amount, 0);
      const assetMinus = allTransactions.filter(t => t.type === 'asset' && t.category === 'Settlement').reduce((sum, t) => sum + t.amount, 0);
      const receivables = allTransactions.filter(t => t.type === 'transfer' && t.category === 'Piutang').reduce((sum, t) => sum + t.amount, 0);
      const debts = allTransactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan').reduce((sum, t) => sum + t.amount, 0);
      const totalAssets = assetPlus + receivables - assetMinus;
      const globalStats = { totalBalance, assets: totalAssets, debts, netWorth: totalBalance + totalAssets - debts };

      let income = 0, expense = 0;
      const monthTxList = allTransactions.filter(tx => tx.date && tx.date.startsWith(targetMonth)).sort((a, b) => new Date(a.date) - new Date(b.date));
      monthTxList.forEach(tx => { if (tx.type === 'income') income += tx.amount; if (tx.type === 'expense') expense += tx.amount; });

      const aiAnalysis = await getAIAnalysis(userData.name || 'User', targetMonthLabel, { income, expense });
      const pdfBuffer = await generatePDFBuffer(userData.name || 'User', targetMonthLabel, { income, expense }, globalStats, monthTxList);

      const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });
      await transporter.sendMail({
        from: `"SteFin AI" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: `Laporan Bulanan SteFin - ${targetMonthLabel}`,
        html: `<div style="font-family:Arial;padding:20px;border:1px solid #eee;border-radius:12px;"><h3>Laporan SteFin</h3>${aiAnalysis || 'Analisis tertunda.'}</div>`,
        attachments: [{ filename: `SteFin_Report_${targetMonth}.pdf`, content: pdfBuffer }]
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) { return res.status(500).json({ error: error.message }); }
}
