"use client";

import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase-config";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(true);

  // Redirect to auth page if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  // Check premium status from Firestore
  useEffect(() => {
    async function checkPremiumStatus() {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          console.log("User doc exists:", userDoc.exists());
          console.log("User data:", userDoc.data());
          console.log("Premium value:", userDoc.data()?.premium);
          console.log("Premium type:", typeof userDoc.data()?.premium);
          setIsPremium(userDoc.exists() && userDoc.data()?.premium === true);
        } catch (error) {
          console.error("Error checking premium status:", error);
          setIsPremium(false);
        }
      }
      setCheckingPremium(false);
    }

    if (user) {
      checkPremiumStatus();
    }
  }, [user]);

  // Show loading state
  if (loading || checkingPremium) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '1.25rem' }}>Loading...</div>
      </div>
    );
  }

  // Not logged in - redirect handled by useEffect
  if (!user) {
    return null;
  }

  // Logged in but not premium - show upgrade message
  if (isPremium === false) {
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
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          {/* Lock Icon */}
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>🔒</div>
          
          {/* Header */}
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            marginBottom: '16px', 
            color: '#1f2937' 
          }}>
            Premium Content
          </h2>
          
          <p style={{ 
            color: '#6b7280', 
            marginBottom: '32px', 
            fontSize: '16px' 
          }}>
            Get access to daily premium picks and analytics
          </p>
          
          {/* Pricing Options */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '32px'
          }}>
            {/* 7-Day Trial */}
            <div style={{
              border: '2px solid #16a34a',
              borderRadius: '12px',
              padding: '24px 16px',
              backgroundColor: '#f0fdf4'
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d', marginBottom: '8px' }}>
                $15
              </div>
              <div style={{ fontSize: '14px', color: '#166534', marginBottom: '16px' }}>
                7-Day Trial
              </div>
              <div style={{ fontSize: '12px', color: '#166534', marginBottom: '16px' }}>
                One-time • No auto-renewal
              </div>
              <a 
                href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02"
                style={{
                  display: 'inline-block',
                  background: '#16a34a',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Try 7 Days →
              </a>
            </div>

            {/* Monthly Subscription */}
            <div style={{
              border: '2px solid #2563eb',
              borderRadius: '12px',
              padding: '24px 16px',
              backgroundColor: '#eff6ff'
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1d4ed8', marginBottom: '8px' }}>
                $49
              </div>
              <div style={{ fontSize: '14px', color: '#1e40af', marginBottom: '16px' }}>
                Monthly
              </div>
              <div style={{ fontSize: '12px', color: '#1e40af', marginBottom: '16px' }}>
                Auto-renews • Cancel anytime
              </div>
              <a 
                href="https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Subscribe Now →
              </a>
            </div>
          </div>

          <p style={{ 
            fontSize: '14px', 
            color: '#9ca3af', 
            marginTop: '24px' 
          }}>
            Logged in as: <strong>{user.email}</strong>
          </p>
          <p style={{ 
            fontSize: '12px', 
            color: '#d1d5db', 
            marginTop: '8px', 
            fontStyle: 'italic' 
          }}>
            After subscribing, we'll activate your account within 24 hours
          </p>
        </div>
      </div>
    );
  }

  // User is premium - show protected content
  return <>{children}</>;
}