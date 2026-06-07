import { isPiutangCategory, getCategoryOptions } from './constants.js'

export const FLOW_STEPS = {
  CONFIRM_TYPE: 'confirm_type',
  ASK_CATEGORY: 'ask_category',
  ASK_INITIAL: 'ask_initial',
  ASK_ACCOUNT: 'ask_account',
  ASK_TARGET_ACCOUNT: 'ask_target_account',
  CONFIRM_SAVE: 'confirm_save'
}

/**
 * Validasi draft transaksi
 */
export const validateDraft = (draft, accounts, customCategories = {}, textContext = '') => {
  const d = { ...draft }
  
  // Jika type belum ada, tidak bisa lanjut jauh
  if (!d.type) return d

  // Jika category diset tapi salah untuk tipenya, reset category
  const validCategories = getCategoryOptions(d.type, customCategories)
  if (d.category && !validCategories.includes(d.category) && d.category !== 'Settlement' && d.category !== 'Pelunasan') {
    d.category = undefined
  }

  // Set default account jika hanya 1
  if (!d.accountId && accounts && accounts.length === 1) {
    d.accountId = accounts[0].id
  }
  
  return d
}

/**
 * Menentukan step selanjutnya berdasarkan draft yang belum lengkap
 */
export const getNextFlowStep = (draft, accounts) => {
  if (!draft.type) return FLOW_STEPS.CONFIRM_TYPE
  if (!draft.category) return FLOW_STEPS.ASK_CATEGORY

  const isTf = draft.type === 'transfer'
  const isPindah = isTf && draft.category === 'Rekening Pribadi'
  const isPiutang = isTf && isPiutangCategory(draft.category)
  
  const isDebt = draft.type === 'debt' && draft.category !== 'Pelunasan'
  const isAsset = draft.type === 'asset' && draft.category !== 'Settlement'

  // Tanya isInitial jika terkait Aset / Utang / Piutang (sebelum SteFin atau baru)
  if ((isAsset || isDebt || isPiutang) && draft.isInitial === undefined) {
    return FLOW_STEPS.ASK_INITIAL
  }

  if (!draft.accountId) return FLOW_STEPS.ASK_ACCOUNT
  
  // Pindah rekening butuh target akun
  if (isPindah && !draft.targetAccountId) return FLOW_STEPS.ASK_TARGET_ACCOUNT

  return FLOW_STEPS.CONFIRM_SAVE
}

/**
 * Mengecek apakah draft sudah cukup untuk disimpan otomatis (bisa skip CONFIRM_SAVE opsional)
 */
export const canAutoConfirm = (draft, accounts) => {
  return getNextFlowStep(draft, accounts) === FLOW_STEPS.CONFIRM_SAVE && draft.amount > 0 && draft.date
}
