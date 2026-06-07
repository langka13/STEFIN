/**
 * Parser lokal untuk transaksi bahasa Indonesia (fallback tanpa AI).
 */

import { validateDraft } from './txFlow.js';
import {
  detectTransactionType,
  detectCategories,
  detectIsInitial,
  reconcileTypeWithText,
} from './transactionDetect.js';

const ACCOUNT_ALIASES = {
  tunai: ['tunai', 'kas', 'cash', 'dompet', 'celengan', 'uang tunai'],
  bca: ['bca'],
  bni: ['bni'],
  bri: ['bri'],
  mandiri: ['mandiri'],
  jago: ['jago', 'bank jago'],
  gopay: ['gopay', 'gojek', 'go-pay'],
  ovo: ['ovo'],
  dana: ['dana'],
  shopeepay: ['shopeepay', 'spay'],
  linkaja: ['linkaja'],
  jenius: ['jenius'],
  seabank: ['seabank', 'sea bank'],
  blu: ['blu', 'blu by bca'],
};

export function parseAccountsFromText(text) {
  if (!text) return [];
  const accounts = [];
  const re = /\{id:"([^"]+)",name:"([^"]+)"\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    accounts.push({ id: m[1], name: m[2] });
  }
  return accounts;
}

export function cleanUserText(text) {
  if (!text) return '';
  return text
    .split(/\n\nAkun tersedia:/i)[0]
    .split(/\n\nCocokkan accountId/i)[0]
    .trim();
}

function parseAmount(lower) {
  // Strip "rp" or "idr" prefix from numbers to allow \b boundary to match
  const normalized = lower.replace(/\b(?:rp|idr)\s*(\d)/gi, '$1');

  const jt = normalized.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta|mio|milyar|miliar)\b/i);
  if (jt) {
    const n = parseFloat(jt[1].replace(/\./g, '').replace(',', '.'));
    return Math.round(n * 1_000_000);
  }

  const rb = normalized.match(/(\d+(?:[.,]\d+)?)\s*(rb|rbu|ribu|k)\b/i);
  if (rb) {
    const n = parseFloat(rb[1].replace(/\./g, '').replace(',', '.'));
    return Math.round(n * 1000);
  }

  const dotted = normalized.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
  if (dotted) return parseInt(dotted[1].replace(/\./g, ''), 10);

  const plain = normalized.match(/\b(\d{4,})\b/);
  if (plain) return parseInt(plain[1], 10);

  return null;
}

function extractAccountQuery(lower) {
  const preposition = lower.match(
    /(?:dari|pake|pakai|peng(?:ai)?|via|lewat|dgn|dengan)\s+([a-z0-9\s\-]+?)(?:\s*$|\s+dan\s|\s+untuk\s)/i
  );
  if (preposition) return preposition[1].trim();

  const end = lower.match(/(?:dari|pake|pakai|peng(?:ai)?|via|lewat|dgn|dengan)\s+(.+)$/i);
  if (end) return end[1].trim();

  // "250rb jago" atau "30000 cash" — akun di akhir kalimat
  const afterAmount = lower.match(
    /\d+\s*(?:rb|rbu|ribu|k|jt|juta)?\s+(jago|bca|bni|bri|mandiri|gopay|ovo|dana|tunai|cash|kas|dompet|jenius|seabank|blu|shopeepay|linkaja)\s*$/i
  );
  if (afterAmount) return afterAmount[1];

  for (const [key, aliases] of Object.entries(ACCOUNT_ALIASES)) {
    for (const a of aliases) {
      if (lower.includes(a)) return a;
    }
    if (lower.endsWith(key) || lower.includes(` ${key}`)) return key;
  }
  return null;
}

export function matchAccountId(lower, accounts = []) {
  if (!accounts.length) return null;

  const query = extractAccountQuery(lower);
  if (!query) return accounts.length === 1 ? accounts[0].id : null;

  const q = query.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const acc of accounts) {
    const name = (acc.name || '').toLowerCase();
    if (name.includes(q) || q.includes(name)) return acc.id;
  }

  for (const [, aliases] of Object.entries(ACCOUNT_ALIASES)) {
    if (aliases.some((a) => q.includes(a) || lower.includes(a))) {
      const found = accounts.find((acc) => {
        const n = (acc.name || '').toLowerCase();
        return aliases.some((a) => n.includes(a));
      });
      if (found) return found.id;
    }
  }

  return null;
}

function buildNote(raw) {
  const ACCOUNT_STRIP = /\s+(cash|tunai|kas|dompet|jago|bca|bni|bri|mandiri|gopay|ovo|dana|jenius|seabank|blu|shopeepay|linkaja)\s*$/i;

  // Hapus prefix rp/idr sebelum angka agar tidak masuk ke note
  const cleanRaw = raw.replace(/\b(?:rp|idr)\s*(\d)/gi, ' $1');

  const beli = cleanRaw.match(/(?:beli|bayar|makan|pesan|catat|tambah|byr)\s+(.+?)(?:\s+\d|\s+dari|\s+pake|\s+pakai|$)/i);
  if (beli) {
    return beli[1].trim().replace(ACCOUNT_STRIP, '').trim().slice(0, 120);
  }

  const cleaned = cleanRaw
    .replace(/\s+\d+\s*(rb|rbu|ribu|k|jt|juta)?.*$/i, '')
    .replace(/\s+(dari|pake|pakai)\s+.+$/i, '')
    .replace(ACCOUNT_STRIP, '')
    .trim();
  return cleaned.slice(0, 120) || raw.slice(0, 80);
}

export function parseTransactionLocal(text, accounts = []) {
  const raw = cleanUserText(text);
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const amount = parseAmount(lower);
  if (!amount || amount <= 0) return null;

  const type = detectTransactionType(lower);
  const cats = detectCategories(type, lower);
  const accountId = matchAccountId(lower, accounts);
  const isInitial = detectIsInitial(lower);

  let draft = {
    type,
    ...cats,
    amount,
    note: buildNote(raw),
    date: new Date().toISOString().split('T')[0],
    accountId: accountId || null,
    ...(isInitial !== undefined ? { isInitial } : {}),
    confidence: 'high',
  };

  draft = reconcileTypeWithText(draft, raw);
  return validateDraft(draft, accounts);
}
