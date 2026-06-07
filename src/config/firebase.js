// ─── src/config/firebase.js ──────────────────────────────────────────────────
// Initializes Firebase using environment variables from .env
// All VITE_ prefixed vars are exposed to the browser by Vite.

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  getFirestore,
  enableIndexedDbPersistence,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize Firebase app
const app = initializeApp(firebaseConfig)

// Auth — supports Email/Password and Google Sign-In
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Firestore — main database
export const db = getFirestore(app)

// Enable offline persistence (data available even without internet)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence only works in one tab at a time
    console.warn('Firestore persistence unavailable: multiple tabs open.')
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support persistence
    console.warn('Firestore persistence not supported in this browser.')
  }
})

export default app
