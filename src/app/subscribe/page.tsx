"use client";

import { useState } from "react";
import Link from "next/link";

export default function SubscribePage() {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToRisks, setAgreedToRisks] = useState(false);
  const [isOver21, setIsOver21] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "trial" | null>(null);
  
  // Your actual Stripe Payment Link URLs
  const STRIPE_MONTHLY_LINK = "https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01";
  const STRIPE_TRIAL_LINK = "https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02"; // Replace with your trial link from Stripe
  
  const canProceed = agreedToTerms && agreedToRisks && isOver21 && selectedPlan;

  const handleProceed = () => {
    if (canProceed) {
      const paymentLink = selectedPlan === "monthly" ? STRIPE_MONTHLY_LINK : STRIPE_TRIAL_LINK;
      window.location.href = paymentLink;
    }
  };

  return (
    <div className="section-wrapper" style={{ backgroundColor: '#f5f5f4' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>
          Subscribe to Premium
        </h1>
        
        {/* Plan Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* 7-Day Trial */}
          <div 
            onClick={() => setSelectedPlan("trial")}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              cursor: 'pointer',
              border: selectedPlan === "trial" ? '4px solid #16a34a' : '4px solid transparent',
              boxShadow: selectedPlan === "trial" ? '0 10px 25px rgba(0,0,0,0.15)' : '0 4px 6px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedPlan !== "trial") {
                e.currentTarget.style.borderColor = '#bbf7d0';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPlan !== "trial") {
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>7-Day Trial</h2>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a', margin: '0' }}>$15</p>
                <p style={{ fontSize: '0.875rem', color: '#78716c', margin: '0.25rem 0 0 0' }}>one-time payment</p>
              </div>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: selectedPlan === "trial" ? '2px solid #16a34a' : '2px solid #d6d3d1',
                backgroundColor: selectedPlan === "trial" ? '#16a34a' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {selectedPlan === "trial" && (
                  <span style={{ color: 'white', fontSize: '0.875rem' }}>✓</span>
                )}
              </div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span>
                <span>Full premium access for 7 days</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span>
                <span>All daily picks and analytics</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span>
                <span>No auto-renewal</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span>
                <span>Perfect for testing the service</span>
              </li>
            </ul>
            
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#14532d', margin: 0 }}>
                🎯 Best for trying before committing
              </p>
            </div>
          </div>

          {/* Monthly Subscription */}
          <div 
            onClick={() => setSelectedPlan("monthly")}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              cursor: 'pointer',
              border: selectedPlan === "monthly" ? '4px solid #2563eb' : '4px solid transparent',
              boxShadow: selectedPlan === "monthly" ? '0 10px 25px rgba(0,0,0,0.15)' : '0 4px 6px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (selectedPlan !== "monthly") {
                e.currentTarget.style.borderColor = '#bfdbfe';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPlan !== "monthly") {
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>Monthly</h2>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb', margin: '0' }}>$49</p>
                <p style={{ fontSize: '0.875rem', color: '#78716c', margin: '0.25rem 0 0 0' }}>per month</p>
              </div>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: selectedPlan === "monthly" ? '2px solid #2563eb' : '2px solid #d6d3d1',
                backgroundColor: selectedPlan === "monthly" ? '#2563eb' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {selectedPlan === "monthly" && (
                  <span style={{ color: 'white', fontSize: '0.875rem' }}>✓</span>
                )}
              </div>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>
                <span>Daily NCAA basketball picks</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>
                <span>Vegas edge analysis</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>
                <span>Advanced analytics and insights</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓</span>
                <span>Cancel anytime</span>
              </li>
            </ul>
            
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1e3a8a', margin: 0 }}>
                💎 Best value for serious bettors
              </p>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {/* Critical Disclaimers */}
          <div style={{ backgroundColor: '#fef2f2', border: '2px solid #dc2626', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#7f1d1d', marginBottom: '0.75rem' }}>
              ⚠️ CRITICAL DISCLAIMERS
            </h3>
            <div style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>NOT FINANCIAL ADVICE:</strong> This service is for entertainment and educational 
                purposes only. We make NO GUARANTEES about prediction accuracy.
              </p>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>GAMBLING RISKS:</strong> Sports betting involves substantial financial risk. 
                You can and likely will lose money. Past performance does not indicate future results.
              </p>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong>NO REFUNDS:</strong> All sales are final. Digital content is non-refundable.
              </p>
              <p style={{ fontWeight: '600', paddingTop: '0.5rem', margin: 0 }}>
                Problem Gambling? Call 1-800-522-4700
              </p>
            </div>
          </div>

          {/* Required Agreements */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={isOver21}
                onChange={(e) => setIsOver21(e.target.checked)}
                style={{ marginTop: '0.25rem', width: '20px', height: '20px', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem' }}>
                I confirm that I am <strong>at least 21 years old</strong> and that sports betting 
                is legal in my jurisdiction.
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={agreedToRisks}
                onChange={(e) => setAgreedToRisks(e.target.checked)}
                style={{ marginTop: '0.25rem', width: '20px', height: '20px', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem' }}>
                I understand that <strong>sports betting involves substantial financial risk</strong>, 
                that I can lose money, and that this service makes no guarantees about prediction accuracy.
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '0.25rem', width: '20px', height: '20px', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem' }}>
                I have read and agree to the{" "}
                <Link href="/terms" target="_blank" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: '600' }}>
                  Terms of Service
                </Link>, including the <strong>no refund policy</strong> and all disclaimers.
              </span>
            </label>
          </div>

          {/* Proceed Button */}
          <button
            onClick={handleProceed}
            disabled={!canProceed}
            style={{
              width: '100%',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: '600',
              border: 'none',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              backgroundColor: !canProceed 
                ? '#d6d3d1' 
                : selectedPlan === "monthly" 
                  ? '#2563eb' 
                  : '#16a34a',
              color: !canProceed ? '#78716c' : 'white',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (canProceed) {
                e.currentTarget.style.backgroundColor = selectedPlan === "monthly" ? '#1d4ed8' : '#15803d';
              }
            }}
            onMouseLeave={(e) => {
              if (canProceed) {
                e.currentTarget.style.backgroundColor = selectedPlan === "monthly" ? '#2563eb' : '#16a34a';
              }
            }}
          >
            {!selectedPlan 
              ? "Select a plan above" 
              : !canProceed 
                ? "Please agree to all terms" 
                : selectedPlan === "monthly"
                  ? "Proceed to Payment - $49/month →"
                  : "Proceed to Payment - $15 (7 days) →"
            }
          </button>

          <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#78716c', marginTop: '1rem', marginBottom: 0 }}>
            {selectedPlan === "monthly" 
              ? "Secure payment processed by Stripe • Auto-renews monthly • Cancel anytime"
              : selectedPlan === "trial"
                ? "Secure payment processed by Stripe • One-time payment • No auto-renewal"
                : "Secure payment processed by Stripe"
            }
          </p>
        </div>

        {/* Additional Help Text */}
        <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#57534e', marginTop: '1.5rem' }}>
          <p>
            Questions? <Link href="/about#contact" style={{ color: '#2563eb', textDecoration: 'underline' }}>Contact us</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
