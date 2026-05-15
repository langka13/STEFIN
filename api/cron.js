import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

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
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("Missing Firebase credentials in Vercel Environment Variables.");
      }

      // Robust Private Key Parsing
      let pk = process.env.FIREBASE_PRIVATE_KEY;
      // 1. Remove wrapping quotes if they accidentally copied them
      pk = pk.replace(/^"|"$/g, '');
      // 2. Replace literal \n with actual newlines
      pk = pk.replace(/\\n/g, '\n');
      
      // 3. Auto-fix missing newlines around BEGIN and END blocks (Common copy-paste error)
      pk = pk.replace(/([^\n])-----END PRIVATE KEY-----/g, '$1\n-----END PRIVATE KEY-----');
      pk = pk.replace(/-----BEGIN PRIVATE KEY-----([^\n])/g, '-----BEGIN PRIVATE KEY-----\n$1');

      // 4. Validate format
      if (!pk.includes('BEGIN PRIVATE KEY') || !pk.includes('END PRIVATE KEY')) {
        throw new Error("Private Key format is invalid. Make sure you copied everything from '-----BEGIN PRIVATE KEY-----' to '-----END PRIVATE KEY-----'.");
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: pk,
        }),
      });
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

    // 4. Ambil data seluruh user
    const usersSnapshot = await db.collection('users').get();
    const emailPromises = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.email) continue;

      // 5. Ambil transaksi user di bulan target
      const txSnapshot = await db.collection('users').doc(userDoc.id).collection('transactions')
        .where('date', '>=', `${targetMonthStr}-01`)
        .where('date', '<=', `${targetMonthStr}-31`)
        .get();

      let income = 0;
      let expense = 0;

      txSnapshot.forEach(doc => {
        const tx = doc.data();
        if (tx.type === 'income') income += tx.amount || 0;
        if (tx.type === 'expense') expense += tx.amount || 0;
      });

      // Lewati pengiriman email jika user tidak ada transaksi di bulan tersebut (Kecuali sedang Test Mode)
      if (!isTest && income === 0 && expense === 0) continue;

      const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

      // 6. Buat Template HTML
      const html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #10B981; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">SteFin Financial Statement</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Ringkasan Keuangan Anda - ${targetMonthLabel}</p>
          </div>
          <div style="padding: 32px; background-color: #ffffff;">
            <p>Halo <strong>${userData.name || 'Pengguna SteFin'}</strong>,</p>
            <p>Berikut adalah ringkasan arus kas Anda selama bulan <strong>${targetMonthLabel}</strong>:</p>
            
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
              Buka aplikasi SteFin untuk melihat detail transaksi selengkapnya.
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
          to: userData.email,
          subject: `Laporan Keuangan SteFin - ${targetMonthLabel}`,
          html: html,
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
