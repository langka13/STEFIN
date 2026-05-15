import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit-table';

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

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

let db;

export default async function handler(req, res) {
  // Mode test via query parameter (?test=true)
  const isTest = req.query.test === 'true';

  // 1. Verifikasi Vercel Cron Secret (Agar API ini tidak bisa ditembak sembarangan oleh orang luar)
  // Untuk kemudahan testing via browser sementara, kita bisa membiarkan test=true jalan tanpa secret
  // NAMUN, karena ini untuk keamanan, tetap wajibkan secret ATAU izinkan local dev
  const authHeader = req.headers.authorization;
  if (!isTest && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  try {
    if (!admin.apps.length) {
      let credential;

      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Cara Paling Aman: Menggunakan JSON atau Base64 Encoded JSON
        try {
          let jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT;
          // Jika string tidak berawal kurung kurawal, asumsikan itu format Base64
          if (!jsonStr.trim().startsWith('{')) {
            jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
          }
          credential = admin.credential.cert(JSON.parse(jsonStr));
        } catch (err) {
          throw new Error("Gagal membaca FIREBASE_SERVICE_ACCOUNT. Error: " + err.message);
        }
      } else {
        // Fallback ke cara lama jika user masih pakai variable terpisah
        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
          throw new Error("Missing Firebase credentials in Vercel Environment Variables. Please use FIREBASE_SERVICE_ACCOUNT.");
        }

        let rawBase64 = process.env.FIREBASE_PRIVATE_KEY
          .replace(/-----BEGIN PRIVATE KEY-----/g, '')
          .replace(/-----END PRIVATE KEY-----/g, '')
          .replace(/\\n/g, '')
          .replace(/[\s\n\r]+/g, '')
          .replace(/"/g, '');
        
        const formattedBase64 = rawBase64.match(/.{1,64}/g)?.join('\n') || '';
        const pk = `-----BEGIN PRIVATE KEY-----\n${formattedBase64}\n-----END PRIVATE KEY-----\n`;

        credential = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: pk,
        });
      }

      admin.initializeApp({ credential });
    }
    if (!db) db = admin.firestore();

    // 2. Setup Nodemailer menggunakan Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // Alamat Gmail Anda
        pass: process.env.GMAIL_PASS, // App Password 16-digit dari Google Account
      },
    });

    // 3. Tentukan bulan laporan
    // Jika test=true, kita gunakan bulan INI (karena data transaksi biasanya ada di bulan ini). 
    // Jika jalannya otomatis (cron), gunakan bulan LALU.
    const now = new Date();
    const targetDate = isTest ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const targetMonthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Nama bulan untuk bahasa Indonesia
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const targetMonthLabel = `${months[targetDate.getMonth()]} ${targetDate.getFullYear()}${isTest ? ' (TESTING MODE)' : ''}`;

    // 4. Ambil data seluruh user dari Firebase Auth (karena email ada di sistem Auth)
    const listUsersResult = await admin.auth().listUsers();
    const emailPromises = [];

    for (const userRecord of listUsersResult.users) {
      if (!userRecord.email) continue;
      const uid = userRecord.uid;

      // Ambil nama user dari profile jika ada (fallback ke display name auth)
      let userName = userRecord.displayName || 'Pengguna SteFin';
      try {
        const profileSnap = await db.collection('users').doc(uid).collection('meta').doc('profile').get();
        if (profileSnap.exists && profileSnap.data().name) {
          userName = profileSnap.data().name;
        }
      } catch (e) {
        // Abaikan jika tidak ada profil
      }

      // 5. Ambil data seluruh akun dan seluruh transaksi untuk menghitung Kekayaan Bersih (Net Worth)
      const accSnapshot = await db.collection('users').doc(uid).collection('accounts').get();
      const accounts = accSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const allTxSnapshot = await db.collection('users').doc(uid).collection('transactions').get();
      const allTransactions = allTxSnapshot.docs.map(d => d.data());

      // Kalkulasi Saldo Kas
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

      // Kalkulasi Aset dan Utang
      const assetPlus = allTransactions.filter(t => t.type === 'asset' && t.category !== 'Settlement').reduce((sum, t) => sum + t.amount, 0);
      const assetMinus = allTransactions.filter(t => t.type === 'asset' && t.category === 'Settlement').reduce((sum, t) => sum + t.amount, 0);
      const receivables = allTransactions.filter(t => t.type === 'transfer' && t.category === 'Piutang').reduce((sum, t) => sum + t.amount, 0);
      const debts = allTransactions.filter(t => t.type === 'debt' && t.category !== 'Pelunasan').reduce((sum, t) => sum + t.amount, 0);
      
      const totalAssets = assetPlus + receivables - assetMinus;
      const netWorth = totalBalance + totalAssets - debts;

      const globalStats = { totalBalance, assets: totalAssets, debts, netWorth };

      // 6. Filter transaksi hanya untuk bulan target
      let income = 0;
      let expense = 0;
      const monthTxList = [];

      allTransactions.forEach(tx => {
        if (tx.date && tx.date.startsWith(targetMonthStr)) {
          monthTxList.push(tx);
          if (tx.type === 'income') income += tx.amount || 0;
          if (tx.type === 'expense') expense += tx.amount || 0;
        }
      });

      // Urutkan transaksi berdasarkan tanggal untuk PDF
      monthTxList.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Lewati pengiriman email jika user tidak ada transaksi di bulan tersebut (Kecuali sedang Test Mode)
      if (!isTest && income === 0 && expense === 0) continue;

      const monthStats = { income, expense };

      // Generate PDF Buffer
      const pdfBuffer = await generatePDFBuffer(userName, targetMonthLabel, monthStats, globalStats, monthTxList);

      // 6. Buat Template HTML
      const html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #10B981; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">SteFin Financial Statement</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Ringkasan Keuangan Anda - ${targetMonthLabel}</p>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
            <p>Halo <strong>${userName}</strong>,</p>
            <p>Berikut adalah ringkasan arus kas Anda selama bulan <strong>${targetMonthLabel}</strong>. Rincian lengkap seluruh transaksi Anda telah kami lampirkan dalam dokumen PDF pada email ini.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">Total Pemasukan</td>
                <td style="padding: 12px 0; text-align: right; color: #10B981; font-weight: bold;">${fmt(income)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #64748b;">Total Pengeluaran</td>
                <td style="padding: 12px 0; text-align: right; color: #EF4444; font-weight: bold;">${fmt(expense)}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: bold;">Net Savings (Selisih)</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 1.1em; color: ${(income - expense) >= 0 ? '#10B981' : '#EF4444'};">${fmt(income - expense)}</td>
              </tr>
            </table>

            <p style="margin-top: 32px; font-size: 14px; color: #64748b; line-height: 1.5;">
              Terus pantau arus kas Anda untuk mencapai kebebasan finansial.<br/>
              Buka aplikasi SteFin untuk melihat detail analitik selengkapnya.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; ${now.getFullYear()} SteFin (Smart Personal Finance). Pesan ini dibuat secara otomatis. Harap jangan membalas email ini.
          </div>
        </div>
      `;

      // 7. Simpan proses pengiriman ke array Promise
      emailPromises.push(
        transporter.sendMail({
          from: `"SteFin Assistant" <${process.env.GMAIL_USER}>`,
          to: userRecord.email,
          subject: `Laporan Keuangan SteFin - ${targetMonthLabel}`,
          html: html,
          attachments: [
            {
              filename: `SteFin_Statement_${targetMonthLabel.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            }
          ]
        })
      );
    }

    // Eksekusi pengiriman massal
    await Promise.all(emailPromises);

    return res.status(200).json({ success: true, emailsSent: emailPromises.length });
  } catch (error) {
    console.error('CRON ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}
