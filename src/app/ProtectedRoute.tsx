import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AuthPage } from './AuthPage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase-config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(true);

  useEffect(() => {
    if (!user) {
      setCheckingPremium(false);
      return;
    }

    // Listen to user's premium status in Firestore
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (doc) => {
        if (doc.exists()) {
          setIsPremium(doc.data()?.premium === true);
        } else {
          // User document doesn't exist, so not premium
          setIsPremium(false);
        }
        setCheckingPremium(false);
      },
      (error) => {
        console.error('Error checking premium status:', error);
        setIsPremium(false);
        setCheckingPremium(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Show loading while checking auth
  if (loading || checkingPremium) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return <AuthPage />;
  }

  // Logged in but not premium - show upgrade message
  if (!isPremium) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            Premium Content
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '8px', fontSize: '16px' }}>
            Get access to daily premium picks and analytics
          </p>
          <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '16px' }}>
            <strong>$49/month</strong>
          </p>
          
          {/* Subscribe Button */}
          <a 
            href={`https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01?prefilled_email=${encodeURIComponent(user.email || '')}`}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px',
              textDecoration: 'none',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Subscribe Now →
          </a>

          <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '24px' }}>
            Logged in as: <strong>{user.email}</strong>
          </p>
          <p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '8px', fontStyle: 'italic' }}>
            After subscribing, email us to activate your account
          </p>
        </div>
      </div>
    );
  }

  // Premium user - show content
  return <>{children}</>;
};
