"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // True once Firebase has fired onAuthStateChanged at least once AND
  // resolved to a non-null user, OR confirmed no session after the
  // debounce window. Prevents ProtectedRoute from redirecting on the
  // spurious null that Firebase emits before restoring a persisted session.
  authSettled: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authSettled: false,
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
  const [authSettled, setAuthSettled] = useState(false);

  useEffect(() => {
    // How long to wait after a null auth event before treating it as a
    // confirmed logout. The diagnostics show Firebase emits null then
    // resolves the real session ~60-90 seconds later on iframe refresh.
    // 2500ms is enough to catch the second callback while being fast
    // enough that a genuine logout still redirects quickly.
    const NULL_DEBOUNCE_MS = 2500;

    // After the tab has been hidden for a long time (e.g. 1+ hours),
    // the ID token expires and Firebase's auth iframe may need to do a
    // full network round-trip to refresh via the stored refresh token.
    // This can take significantly longer than the normal debounce, so
    // we use a wider window after a visibility change.
    const VISIBILITY_DEBOUNCE_MS = 8000;

    let nullTimer: ReturnType<typeof setTimeout> | null = null;
    let returningFromHidden = false;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Real user — cancel any pending null-redirect timer and settle immediately
        if (nullTimer) {
          clearTimeout(nullTimer);
          nullTimer = null;
        }
        returningFromHidden = false;
        setUser(firebaseUser);
        setLoading(false);
        setAuthSettled(true);

        // Background sync — fire and forget, never blocks or affects auth state
        syncUserDocument(firebaseUser);
      } else {
        // Null event — could be genuine logout OR the spurious pre-session-restore
        // null that Firebase emits when its auth iframe refreshes. Don't act on it
        // immediately; wait for the debounce window to see if a real user follows.
        setUser(null);
        setLoading(false);

        // Use a longer debounce if we just returned from a hidden tab, since
        // the token refresh involves a network round-trip.
        const debounce = returningFromHidden ? VISIBILITY_DEBOUNCE_MS : NULL_DEBOUNCE_MS;

        // authSettled stays false until the timer confirms no user is coming
        if (nullTimer) clearTimeout(nullTimer);
        nullTimer = setTimeout(() => {
          setAuthSettled(true);
        }, debounce);
      }
    });

    // ── Visibility change handler ──────────────────────────────────────
    // When the tab regains focus after being backgrounded, the Firebase
    // ID token may have expired. Firebase will try to refresh it
    // automatically, but onAuthStateChanged may emit null first while
    // the refresh is in flight. We:
    //   1. Set returningFromHidden so the null-debounce uses the longer window
    //   2. Reset authSettled to prevent ProtectedRoute from redirecting
    //   3. Proactively force a token refresh if auth.currentUser is cached
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      returningFromHidden = true;

      // If auth.currentUser is still cached (token expired but refresh
      // token is valid), proactively kick off a refresh. This resolves
      // the session faster than waiting for Firebase's lazy refresh.
      if (auth.currentUser) {
        auth.currentUser.getIdToken(true).then(() => {
          // Token refreshed — onAuthStateChanged will fire with the user
          // but just in case it doesn't, settle manually.
          setUser(auth.currentUser);
          setAuthSettled(true);
          returningFromHidden = false;
        }).catch(() => {
          // Refresh token is also invalid — genuine session expiry.
          // Let the normal null-debounce flow handle the redirect.
        });
      } else {
        // No cached currentUser — re-open the settlement window so
        // Firebase has time to restore the session from IndexedDB.
        setAuthSettled(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (nullTimer) clearTimeout(nullTimer);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authSettled }}>
      {children}
    </AuthContext.Provider>
  );
};
