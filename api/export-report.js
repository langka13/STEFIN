import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit-table';

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

// Helper to call Gemini AI for report analysis
async function getAIAnalysis(userName, monthLabel, stats, context) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return "AI Analysis tidak tersedia (API Key missing).";

  const prompt = `
    Anda adalah konsultan keuangan pribadi cerdas bernama SteFin AI.
    Berikan analisis terstruktur, ramah, dan mudah dimengerti untuk laporan bulanan pengguna bernama ${userName}.
    
    Data Keuangan Bulan ${monthLabel}:
    - Total Pemasukan: ${fmt(stats.income)}
    - Total Pengeluaran: ${fmt(stats.expense)}
    - Sisa Dana: ${fmt(stats.income - stats.expense)}
    - Rasio Tabungan: ${stats.savingsRate}%
    
    Konteks Tambahan:
    ${JSON.stringify(context)}

    Format Analisis (Gunakan HTML sederhana seperti <b>, <p>, <ul>):
    1. **Status Keuangan**: Berikan penilaian singkat (Sehat, Perlu Perhatian, atau Kritis).
    2. **Insight Utama**: Sebutkan 1-2 hal menarik dari data tersebut.
    3. **Rekomendasi**: Berikan 2 langkah praktis untuk bulan depan.
    
    Catatan: Jangan terlalu teknis, gunakan gaya bahasa yang memotivasi.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan analisis AI.";
    // Clean up markdown if any
    return text.replace(/```html/g, '').replace(/```/g, '');
  } catch (e) {
    console.error("AI Report Error:", e);
    return "Terjadi kesalahan saat memproses analisis AI.";
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
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Kekayaan Bersih', 55, boxY);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(globalStats.netWorth >= 0 ? '#10b981' : '#ef4444').text(`${fmt(globalStats.netWorth)}`, 55, boxY + 12);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Saldo Kas Bebas', 220, boxY);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`${fmt(globalStats.totalBalance)}`, 220, boxY + 14);
    doc.moveDown(3);

    const yPos = doc.y + 15;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Ringkasan Arus Kas Bulan Ini`, 40, yPos);
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10);
    const net = monthStats.income - monthStats.expense;
    doc.text(`Total Pemasukan`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#10b981').text(`${fmt(monthStats.income)}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fillColor('#0f172a').text(`Total Pengeluaran`); doc.moveUp(); doc.font('Helvetica-Bold').fillColor('#ef4444').text(`${fmt(monthStats.expense)}`, { align: 'right' });
    doc.moveDown(2);

    const tableArray = {
      headers: ['Tanggal', 'Kategori', 'Tipe', 'Catatan', 'Nominal'],
      rows: transactions.map(tx => [
        tx.date || '-',
        tx.level1 || tx.category || '-',
        tx.type,
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

    // Filter month tx
    const monthTxList = allTransactions.filter(tx => tx.date && tx.date.startsWith(targetMonth)).sort((a, b) => new Date(a.date) - new Date(b.date));
    const income = monthTxList.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = monthTxList.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    // Calc Net Worth (Simple version for export)
    let totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    // Adjust with all transactions
    allTransactions.forEach(tx => {
       if (tx.type === 'income') totalBalance += tx.amount;
       if (tx.type === 'expense') totalBalance -= tx.amount;
    });

    const aiAnalysis = await getAIAnalysis(userName, targetMonthLabel, { income, expense, savingsRate }, { txCount: monthTxList.length });

    const pdfBuffer = await generatePDFBuffer(userName, targetMonthLabel, { income, expense }, { netWorth: totalBalance, totalBalance }, monthTxList);

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
          <p>Halo <strong>${userName}</strong>,</p>
          <p>Laporan keuangan Anda sudah siap. Berikut adalah analisis cerdas dari <strong>SteFin AI</strong>:</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #10B981; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6;">
            ${aiAnalysis}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Total Pemasukan</td>
              <td style="padding: 12px 0; text-align: right; color: #10B981; font-weight: bold;">${fmt(income)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0; color: #64748b;">Total Pengeluaran</td>
              <td style="padding: 12px 0; text-align: right; color: #EF4444; font-weight: bold;">${fmt(expense)}</td>
            </tr>
          </table>
          
          <p style="margin-top: 24px;">Rincian transaksi lengkap telah kami lampirkan dalam format PDF.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
          &copy; SteFin Assistant.
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"SteFin AI" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Laporan Keuangan & Analisis AI - ${targetMonthLabel}`,
      html: html,
      attachments: [{ filename: `SteFin_Report_${targetMonth}.pdf`, content: pdfBuffer }]
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('EXPORT ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}
