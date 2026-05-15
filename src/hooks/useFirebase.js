// ─── src/hooks/useFirebase.js ────────────────────────────────────────────────
// All Firestore read/write operations for SteFin.
//
// Data structure in Firestore:
//   users/{uid}/transactions/{txId}   ← transaction documents
//   users/{uid}/accounts/{accountId}  ← account documents
//   users/{uid}/profile               ← onboarding flag + user preferences
//
// This hook is data-only. No UI logic lives here.

import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export function useFirebase(uid) {
  const [transactions, setTransactions]   = useState([])
  const [accounts, setAccounts]           = useState([])
  const [profile, setProfile]             = useState(null)
  const [dbLoading, setDbLoading]         = useState(true)

  // ── Real-time listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setTransactions([])
      setAccounts([])
      setProfile(null)
      setDbLoading(false)
      return
    }

    setDbLoading(true)
    let resolved = 0
    const done = () => { resolved++; if (resolved >= 3) setDbLoading(false) }

    // Transactions listener — ordered newest first
    const txQuery = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('date', 'desc'),
    )
    const unsubTx = onSnapshot(txQuery, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      done()
    }, (err) => { console.error('Tx listener error:', err); done() })

    // Accounts listener
    const unsubAcc = onSnapshot(
      collection(db, 'users', uid, 'accounts'),
      (snap) => {
        setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        done()
      },
      (err) => { console.error('Accounts listener error:', err); done() },
    )

    // Profile document (single doc, not a collection)
    const profileRef = doc(db, 'users', uid, 'meta', 'profile')
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      setProfile(snap.exists() ? snap.data() : null)
      done()
    }, (err) => { console.error('Profile listener error:', err); done() })

    return () => {
      unsubTx()
      unsubAcc()
      unsubProfile()
    }
  }, [uid])

  // ── Profile ───────────────────────────────────────────────────────────────
  const saveProfile = useCallback(async (data) => {
    if (!uid) return
    const ref = doc(db, 'users', uid, 'meta', 'profile')
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
  }, [uid])

  // ── Transactions ──────────────────────────────────────────────────────────
  const addTransaction = useCallback(async (tx) => {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'transactions'), {
      ...tx,
      createdAt: serverTimestamp(),
    })
  }, [uid])

  const updateTransaction = useCallback(async (tx) => {
    if (!uid || !tx.id) return
    const { id, ...data } = tx
    await updateDoc(doc(db, 'users', uid, 'transactions', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [uid])

  const deleteTransaction = useCallback(async (id) => {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'transactions', id))
  }, [uid])

  // ── Accounts ──────────────────────────────────────────────────────────────
  const addAccount = useCallback(async (account) => {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'accounts'), {
      ...account,
      createdAt: serverTimestamp(),
    })
  }, [uid])

  const updateAccount = useCallback(async (account) => {
    if (!uid || !account.id) return
    const { id, ...data } = account
    await updateDoc(doc(db, 'users', uid, 'accounts', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }, [uid])

  const deleteAccount = useCallback(async (id) => {
    if (!uid) return
    await deleteDoc(doc(db, 'users', uid, 'accounts', id))
  }, [uid])

  return {
    // state
    transactions,
    accounts,
    profile,
    dbLoading,
    // profile
    saveProfile,
    // transactions
    addTransaction,
    updateTransaction,
    deleteTransaction,
    // accounts
    addAccount,
    updateAccount,
    deleteAccount,
  }
}
