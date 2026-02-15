"use client";

import { useAuth } from "../AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";
import Link from "next/link";

interface UserData {
  email: string;
  premium: boolean;
  type?: 'trial' | 'subscription';
  expiresAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUserData() {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
      setLoadingData(false);
    }

    if (user) {
      fetchUserData();
    }
  }, [user]);

  if (loading || loadingData) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user || !userData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSubscriptionStatus = () => {
    if (!userData.premium) {
      return {
        status: 'No Active Subscription',
        color: '#dc2626',
        bgColor: '#fee2e2'
      };
    }

    if (userData.type === 'trial') {
      const daysLeft = userData.expiresAt 
        ? Math.ceil((new Date(userData.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      return {
        status: `7-Day Trial (${daysLeft} days left)`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        expiresAt: userData.expiresAt
      };
    }

    if (userData.type === 'subscription') {
      return {
        status: 'Monthly Subscription',
        color: '#1d4ed8',
        bgColor: '#eff6ff'
      };
    }

    return {
      status: 'Premium',
      color: '#15803d',
      bgColor: '#f0fdf4'
    };
  };

  const subscriptionInfo = getSubscriptionStatus();

  return (
    <div className="section-wrapper">
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '2rem 1.5rem' 
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          marginBottom: '2rem',
          color: '#1f2937'
        }}>
          Account Dashboard
        </h1>

        {/* User Info Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            color: '#374151'
          }}>
            Account Information
          </h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Email:</span>
            <div style={{ fontSize: '1rem', fontWeight: '500', color: '#1f2937' }}>
              {userData.email}
            </div>
          </div>

          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Member since:</span>
            <div style={{ fontSize: '1rem', fontWeight: '500', color: '#1f2937' }}>
              {formatDate(userData.createdAt)}
            </div>
          </div>
        </div>

        {/* Subscription Status Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            color: '#374151'
          }}>
            Subscription Status
          </h2>

          <div style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            backgroundColor: subscriptionInfo.bgColor,
            color: subscriptionInfo.color,
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            {subscriptionInfo.status}
          </div>

          {subscriptionInfo.expiresAt && (
            <div style={{ marginTop: '1rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Expires on:</span>
              <div style={{ fontSize: '1rem', fontWeight: '500', color: '#1f2937' }}>
                {formatDate(subscriptionInfo.expiresAt)}
              </div>
            </div>
          )}

          {!userData.premium && (
            <div style={{ marginTop: '1.5rem' }}>
              <Link
                href="/ncaa-todays-picks"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}
              >
                View Premium Options
              </Link>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            color: '#374151'
          }}>
            Quick Links
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {userData.premium && (
              <Link
                href="/ncaa-todays-picks"
                style={{
                  color: '#2563eb',
                  textDecoration: 'none',
                  fontSize: '1rem'
                }}
                className="hover:underline"
              >
                → View Today's Premium Picks
              </Link>
            )}
            
            <Link
              href="/"
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: '1rem'
              }}
              className="hover:underline"
            >
              → Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}