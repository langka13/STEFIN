// ─── src/hooks/useAuth.js ────────────────────────────────────────────────────
// Handles all authentication: Email/Password, Google Sign-In, and logout.
// Returns the current user and loading state, consumed by SteFin.jsx.

import { useState, useEffect } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'

export function useAuth() {
  const [user, setUser] = useState(null)
  // true while Firebase checks localStorage for an existing session
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid:   firebaseUser.uid,
          name:  firebaseUser.displayName || firebaseUser.email.split('@')[0],
          email: firebaseUser.email,
          photo: firebaseUser.photoURL || null,
        })
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Email + Password registration
  const registerWithEmail = async (name, email, password) => {
    setAuthError(null)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      // Set display name immediately after registration
      await updateProfile(result.user, { displayName: name })
      setUser({
        uid:   result.user.uid,
        name,
        email: result.user.email,
        photo: null,
      })
      return { success: true }
    } catch (err) {
      const msg = getAuthErrorMessage(err.code)
      setAuthError(msg)
      return { success: false, error: msg }
    }
  }

  // Email + Password login
  const loginWithEmail = async (email, password) => {
    setAuthError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { success: true }
    } catch (err) {
      const msg = getAuthErrorMessage(err.code)
      setAuthError(msg)
      return { success: false, error: msg }
    }
  }

  // Google Sign-In (popup)
  const loginWithGoogle = async () => {
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
      return { success: true }
    } catch (err) {
      const msg = getAuthErrorMessage(err.code)
      setAuthError(msg)
      return { success: false, error: msg }
    }
  }

  // Logout
  const logout = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return {
    user,
    authLoading,
    authError,
    setAuthError,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    logout,
  }
}

// ─── Translate Firebase error codes to Bahasa Indonesia ──────────────────────
function getAuthErrorMessage(code) {
  const messages = {
    'auth/user-not-found':      'Email tidak terdaftar. Silakan daftar terlebih dahulu.',
    'auth/wrong-password':      'Password salah. Coba lagi.',
    'auth/invalid-credential':  'Email atau password salah.',
    'auth/email-already-in-use':'Email sudah digunakan. Silakan masuk.',
    'auth/weak-password':       'Password terlalu lemah (minimal 6 karakter).',
    'auth/invalid-email':       'Format email tidak valid.',
    'auth/popup-closed-by-user':'Login Google dibatalkan.',
    'auth/network-request-failed': 'Gagal terhubung. Periksa koneksi internet.',
  }
  return messages[code] || `Terjadi kesalahan (${code}). Coba lagi.`
}
