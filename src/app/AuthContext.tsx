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
    // First null from Firebase on cold load — short debounce since we've
    // never seen a user yet (could be a genuine anonymous visitor).
    const COLD_NULL_DEBOUNCE_MS = 3000;

    // Null after we previously had a user — much longer debounce. Firebase
    // token refreshes can take 10-30s on slow connections, and the auth
    // iframe refresh after tab backgrounding can take even longer. We should
    // almost never redirect a previously-authenticated user.
    const WARM_NULL_DEBOUNCE_MS = 30000;

    let nullTimer: ReturnType<typeof setTimeout> | null = null;
    let hadUserThisSession = false;
    let retryCount = 0;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Real user — cancel any pending null-redirect timer and settle immediately
        if (nullTimer) {
          clearTimeout(nullTimer);
          nullTimer = null;
        }
        hadUserThisSession = true;
        retryCount = 0;
        setUser(firebaseUser);
        setLoading(false);
        setAuthSettled(true);

        // Background sync — fire and forget, never blocks or affects auth state
        syncUserDocument(firebaseUser);
      } else {
        // Null event — could be genuine logout OR spurious null from Firebase
        // iframe refresh / token expiry. Strategy depends on whether we've
        // previously seen a user in this session.
        setLoading(false);

        if (!hadUserThisSession) {
          // Cold null — first load, never had a user. Short debounce.
          setUser(null);
          if (nullTimer) clearTimeout(nullTimer);
          nullTimer = setTimeout(() => {
            setAuthSettled(true);
          }, COLD_NULL_DEBOUNCE_MS);
        } else {
          // Warm null — previously authenticated. Don't clear user state
          // immediately; keep showing the page while we try to recover.
          // This prevents the flash-to-login on token refresh.

          // Proactively try to refresh the token
          if (auth.currentUser) {
            auth.currentUser.getIdToken(true).then(() => {
              setUser(auth.currentUser);
              setAuthSettled(true);
            }).catch(() => {
              // Refresh token truly invalid — genuine logout
              setUser(null);
              setAuthSettled(true);
            });
          } else {
            // No currentUser cached — Firebase may be restoring from IndexedDB.
            // Try a few times before giving up.
            retryCount++;
            if (nullTimer) clearTimeout(nullTimer);

            if (retryCount <= 3) {
              // Keep waiting — don't settle yet, don't clear user
              nullTimer = setTimeout(() => {
                // After waiting, check if Firebase recovered
                if (auth.currentUser) {
                  auth.currentUser.getIdToken(true).then(() => {
                    setUser(auth.currentUser);
                    setAuthSettled(true);
                    retryCount = 0;
                  }).catch(() => {
                    setUser(null);
                    setAuthSettled(true);
                  });
                } else {
                  // Still no user after extended wait — genuine logout
                  setUser(null);
                  setAuthSettled(true);
                }
              }, WARM_NULL_DEBOUNCE_MS);
            } else {
              // Multiple null events with no recovery — genuine logout
              setUser(null);
              setAuthSettled(true);
            }
          }
        }
      }
    });

    // ── Visibility change handler ──────────────────────────────────────
    // When the tab regains focus after being backgrounded, proactively
    // refresh the token. Don't reset authSettled — let the user keep
    // seeing the page while the refresh happens in the background.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      if (auth.currentUser) {
        // Proactive refresh — prevents the null-then-user flicker
        auth.currentUser.getIdToken(true).then(() => {
          setUser(auth.currentUser);
          setAuthSettled(true);
        }).catch(() => {
          // Refresh token invalid — will be handled by onAuthStateChanged
        });
      }
      // If no currentUser, don't reset authSettled. Let Firebase's
      // internal IndexedDB restoration flow handle it via onAuthStateChanged.
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
