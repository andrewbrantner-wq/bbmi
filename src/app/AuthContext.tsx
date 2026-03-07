"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
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

        // Create user document in Firestore if it doesn't exist
        if (firebaseUser) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            await setDoc(userRef, {
              email: firebaseUser.email,
              premium: false,
              createdAt: new Date().toISOString(),
            });
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
