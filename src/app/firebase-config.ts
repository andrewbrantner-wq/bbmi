import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize auth with explicit persistence. localStorage first (more durable
// across browsers, especially Safari/iOS where ITP can purge IndexedDB after
// 7 days of inactivity), IndexedDB as fallback.
//
// Why initializeAuth instead of getAuth:
//   initializeAuth sets persistence synchronously at construction time, before
//   any auth state is restored or onAuthStateChanged fires. This eliminates the
//   need for an async setPersistence() guard before sign-in calls. If this is
//   ever reverted to getAuth() + setPersistence(), the sign-in pages MUST await
//   setPersistence() before calling signInWithEmailAndPassword — otherwise
//   credentials may be stored with the wrong persistence mode.
export const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, indexedDBLocalPersistence],
});

export const db = getFirestore(app);
