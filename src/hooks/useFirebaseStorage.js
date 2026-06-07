// ─── src/hooks/useFirebaseStorage.js ─────────────────────────────────────────
// Manages the onboarding completion flag and user preference storage.
// Wraps saveProfile from useFirebase with onboarding-specific helpers.

import { useCallback } from 'react'

/**
 * @param {Function} saveProfile  - from useFirebase hook
 * @param {object|null} profile   - current profile doc from Firestore
 */
export function useFirebaseStorage(saveProfile, profile) {

  // Mark onboarding as complete in Firestore
  const completeOnboarding = useCallback(async (userName) => {
    await saveProfile({
      hasOnboarded: true,
      name: userName,
      onboardedAt: new Date().toISOString(),
    })
  }, [saveProfile])

  // Save arbitrary user preferences (currency, language, etc.)
  const savePreferences = useCallback(async (prefs) => {
    await saveProfile({ preferences: prefs })
  }, [saveProfile])

  const hasOnboarded  = profile?.hasOnboarded === true
  const preferences   = profile?.preferences || {}

  return {
    hasOnboarded,
    preferences,
    completeOnboarding,
    savePreferences,
  }
}
