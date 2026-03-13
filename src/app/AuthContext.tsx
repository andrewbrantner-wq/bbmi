"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true
});

export const useAuth = () => useContext(AuthContext);

// Firestore user document sync — runs in the background, never blocks auth state.
// Only creates the user doc if it doesn't exist. Pending grants are applied
// exclusively server-side via Admin SDK (webhook → pending_grants → users).
// Client-side grant application was removed because the Firestore security rules
// correctly block client writes to premium/stripe fields, causing silent failures.
async function syncUserDocument(firebaseUser: User): Promise<void> {
  if (!firebaseUser.email) return;
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: firebaseUser.email.toLowerCase().trim(),
        premium: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('User document sync error:', err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: the onAuthStateChanged callback must be synchronous.
    //
    // Previously this was an async callback that awaited Firestore operations
    // before calling setLoading(false). Firebase does not await async callbacks —
    // it fire-and-forgets them. This meant that on every token refresh (~60 min),
    // Firebase would fire onAuthStateChanged with user=null, then setUser(null)
    // and setLoading(false) would fire immediately, causing ProtectedRoute to see
    // loading=false + user=null and redirect to /auth — even though the user was
    // still authenticated and a second callback with the refreshed user was imminent.
    //
    // Additionally, setPersistence was previously called inside this effect before
    // subscribing to onAuthStateChanged. This caused Firebase to re-evaluate its
    // internal auth state on every page load, which could emit a spurious null event
    // before restoring the session. Firebase already defaults to browserLocalPersistence
    // on web — calling setPersistence redundantly was only causing harm.
    //
    // Fix: set user and loading synchronously the instant Firebase reports auth state,
    // then kick off Firestore work as a non-blocking background task that cannot
    // affect routing or auth state regardless of how long it takes or whether it errors.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Background sync — fire and forget, never blocks or affects auth state
      if (firebaseUser) {
        syncUserDocument(firebaseUser);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
