"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth, db } from './firebase-config';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true
});

export const useAuth = () => useContext(AuthContext);

// Check if a pending_grants record exists for this email and apply it.
// Called both on new user creation and on every login as a catch-up.
async function applyPendingGrant(uid: string, email: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const pendingRef = doc(db, 'pending_grants', normalizedEmail);
    const pendingDoc = await getDoc(pendingRef);

    if (!pendingDoc.exists()) {
      return false;
    }

    const grantData = pendingDoc.data();
    const { email: _email, createdAt: _createdAt, ...fieldsToApply } = grantData;

    // Apply the grant to the user document
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...fieldsToApply,
      updatedAt: new Date().toISOString(),
    });

    // Delete the pending grant so it doesn't re-apply
    await deleteDoc(pendingRef);

    console.log(`✅ Applied pending grant to ${email} (${grantData.type})`);
    return true;
  } catch (err) {
    console.error('Error applying pending grant:', err);
    return false;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      // CRITICAL: await setPersistence before subscribing to onAuthStateChanged.
      // Without this, the first auth state callback can fire with user=null
      // before Firebase has had a chance to restore the session from localStorage,
      // causing a false logout redirect on every page load.
      if (typeof window !== 'undefined') {
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch (err) {
          console.error('Failed to set auth persistence:', err);
        }
      }

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);

        if (firebaseUser && firebaseUser.email) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // New user — create the doc, then immediately check for a pending grant
            await setDoc(userRef, {
              email: firebaseUser.email.toLowerCase().trim(),
              premium: false,
              createdAt: new Date().toISOString(),
            });
            await applyPendingGrant(firebaseUser.uid, firebaseUser.email);
          } else {
            // Existing user — check for pending grant as catch-up
            // (handles edge case where doc existed but grant arrived before login)
            const data = userDoc.data();
            if (!data.premium) {
              await applyPendingGrant(firebaseUser.uid, firebaseUser.email);
            }
          }
        }

        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
