import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit-table';

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

// Helper to call Gemini AI for report analysis
async function getAIAnalysis(userName, monthLabel, stats) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;

  const prompt = `
    Anda adalah Pakar Analis Keuangan SteFin AI.
    Berikan Financial Review untuk ${userName} (Bulan ${monthLabel}):
    - Pemasukan: ${fmt(stats.income)}
    - Pengeluaran: ${fmt(stats.expense)}
    - Sisa: ${fmt(stats.income - stats.expense)}
    
    TUGAS: Berikan analisis EXPERT, DETAIL, namun EFEKTIF (Singkat & Padat).
    
    Struktur (HTML):
    1. <b>Kesehatan Finansial</b>: Berikan skor 1-10 dan alasan teknis singkat.
    2. <b>Analisis Pengeluaran</b>: Identifikasi jika pengeluaran tidak efisien.
    3. <b>Action Plan</b>: 2 langkah strategis untuk bulan depan agar aset tumbuh.
    
    Hanya berikan konten inti. Jangan gunakan kalimat pembuka/penutup basa-basi.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.replace(/```html/g, '').replace(/```/g, '').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  } catch (e) {
    return null;
  }
}

function generatePDFBuffer(userName, targetMonthLabel, monthStats, globalStats, transactions) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });

    // ─── Header ───
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text('SteFin', { continued: true }).fillColor('#10b981').text('Statement', { align: 'left' });
    doc.moveUp();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#64748b').text('LAPORAN KEUANGAN PRIBADI', { align: 'right' });
    doc.font('Helvetica').fontSize(9).text(`Periode: ${targetMonthLabel}`, { align: 'right' });
    
    doc.moveDown(2);
    
    // ─── User Info ───
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Dipersiapkan untuk:`, { continued: true }).font('Helvetica').text(` ${userName}`);
    doc.moveDown(1.5);

    // ─── Posisi Keuangan (Global) ───
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

    // ─── Laporan Operasional Bulanan ───
    const yPos = doc.y + 15;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Ringkasan Arus Kas Bulan Ini`, 40, yPos);
    doc.moveDown(1);
    
    doc.font('Helvetica').fontSize(10);
    const net = monthStats.income - monthStats.expense;
    const savingsRate = monthStats.income > 0 ? Math.round((net / monthStats.income) * 100) : 0;

    doc.text(`Total Pemasukan`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#10b981').text(`${fmt(monthStats.income)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Total Pengeluaran`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#ef4444').text(`${fmt(monthStats.expense)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Net Savings (Selisih)`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor(net >= 0 ? '#10b981' : '#ef4444').text(`${fmt(net)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Savings Rate (Tingkat Tabungan)`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${savingsRate}%`, { align: 'right' });
    
    doc.moveDown(2);

    // ─── Table Data ───
    const tableArray = {
      headers: ['Tanggal', 'Kategori', 'Tipe', 'Catatan', 'Nominal'],
      rows: transactions.map(tx => [
        tx.date || '-',
        tx.level1 || tx.category || '-',
        tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : tx.type === 'asset' ? 'Aset' : tx.type === 'debt' ? 'Utang' : 'Transfer',
        tx.note || '-',
        fmt(tx.amount || 0)
      ])
    };

    doc.table(tableArray, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a'),
      prepareRow: (row, i) => doc.font('Helvetica').fontSize(8).fillColor('#334155')
    });

    doc.end();
  });
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).end('Unauthorized');
  }

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

      const txByAccount = {};
      allTransactions.forEach(tx => {
        if (!txByAccount[tx.accountId]) txByAccount[tx.accountId] = [];
        txByAccount[tx.accountId].push(tx);
        if (tx.targetAccountId) {
          if (!txByAccount[tx.targetAccountId]) txByAccount[tx.targetAccountId] = [];
          txByAccount[tx.targetAccountId].push(tx);
        }
      });

      let totalBalance = 0;
      accounts.forEach(acc => {
        let currentBalance = acc.balance || 0;
        (txByAccount[acc.id] || []).forEach(tx => {
          if (tx.accountId === acc.id) {
            if (tx.type === 'income') currentBalance += tx.amount;
            if (tx.type === 'debt') {
              if (tx.category === 'Pelunasan') currentBalance -= tx.amount;
              else if (!tx.isInitial) currentBalance += tx.amount;
            }
            if (tx.type === 'expense') currentBalance -= tx.amount;
            if (tx.type === 'transfer') {
              if (tx.category === 'Piutang') {
                if (!tx.isInitial) currentBalance -= tx.amount;
              } else {
                currentBalance -= tx.amount;
              }
            }
            if (tx.type === 'asset') {
              if (tx.category === 'Settlement') currentBalance += tx.amount;
              else if (!tx.isInitial) currentBalance -= tx.amount;
            }
          }
          if (tx.targetAccountId === acc.id && tx.type === 'transfer') {
            currentBalance += tx.amount;
          }
        });
        totalBalance += currentBalance;
      });

      const assetPlus = allTransactions.filter(t => t.type === 'asset' && t.category !== 'Settlement').reduce((sum, t) => sum + t.amount, 0);
      const assetMinus = allTransactions.filter(t => t.type === 'asset' && t.category === 'Settlement').reduce((sum, t) => sum + t.amount, 0);
      const receivables = allTransactions.filter(t => t.type === 'transfer' && t.category === 'Piutang').reduce((sum, t) => sum + t.amount, 0);
      const debts = allTransactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan').reduce((sum, t) => sum + t.amount, 0);
      
      const totalAssets = assetPlus + receivables - assetMinus;
      const netWorth = totalBalance + totalAssets - debts;
      const globalStats = { totalBalance, assets: totalAssets, debts, netWorth };

      let income = 0;
      let expense = 0;
      const monthTxList = allTransactions.filter(tx => tx.date && tx.date.startsWith(targetMonth)).sort((a, b) => new Date(a.date) - new Date(b.date));
      
      monthTxList.forEach(tx => {
        if (tx.type === 'income') income += tx.amount || 0;
        if (tx.type === 'expense') expense += tx.amount || 0;
      });

      const aiAnalysis = await getAIAnalysis(userData.name || 'Pengguna SteFin', targetMonthLabel, { income, expense });

      const pdfBuffer = await generatePDFBuffer(userData.name || 'Pengguna SteFin', targetMonthLabel, { income, expense }, globalStats, monthTxList);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
      });

      const html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #10B981; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">Laporan Keuangan SteFin</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${targetMonthLabel}</p>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
            <p>Halo <strong>${userData.name || 'Pengguna SteFin'}</strong>,</p>
            <p>Berikut adalah <b>Financial Review</b> bulan ini:</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #10B981; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6;">
              ${aiAnalysis || '<i>Analisis tidak dapat dimuat.</i>'}
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">Pemasukan</td>
                <td style="padding: 12px 0; text-align: right; color: #10B981; font-weight: bold;">${fmt(income)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">Pengeluaran</td>
                <td style="padding: 12px 0; text-align: right; color: #EF4444; font-weight: bold;">${fmt(expense)}</td>
              </tr>
            </table>
            
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Rincian lengkap posisi aset terlampir pada PDF.</p>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; SteFin Assistant.
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"SteFin AI" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: `Laporan Keuangan Otomatis - ${targetMonthLabel}`,
        html: html,
        attachments: [{ filename: `SteFin_Monthly_Report_${targetMonth}.pdf`, content: pdfBuffer }]
      });
    }

    return res.status(200).json({ success: true, message: 'Monthly reports sent' });
  } catch (error) {
    console.error('CRON ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}
