"use client";

import { useState } from "react";
import Link from "next/link";

export default function SubscribePage() {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToRisks, setAgreedToRisks] = useState(false);
  const [isOver21, setIsOver21] = useState(false);
  
  // Your actual Stripe Payment Link URL
  const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01";
  
  const canProceed = agreedToTerms && agreedToRisks && isOver21;

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8 text-center">Subscribe to Premium</h1>
        
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4">Premium Access - $49/month</h2>
            <ul className="space-y-2 text-stone-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Daily NCAA basketball picks with Vegas edge analysis
              </li>
              
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Advanced analytics and insights
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                Cancel anytime
              </li>
            </ul>
          </div>

          {/* Critical Disclaimers */}
          <div className="bg-red-50 border-2 border-red-600 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-red-900 mb-3">⚠️ CRITICAL DISCLAIMERS</h3>
            <div className="space-y-3 text-sm text-red-900">
              <p>
                <strong>NOT FINANCIAL ADVICE:</strong> This service is for entertainment and educational 
                purposes only. We make NO GUARANTEES about prediction accuracy.
              </p>
              <p>
                <strong>GAMBLING RISKS:</strong> Sports betting involves substantial financial risk. 
                You can and likely will lose money. Past performance does not indicate future results.
              </p>
              <p>
                <strong>NO REFUNDS:</strong> All sales are final. Digital content is non-refundable.
              </p>
              <p className="font-semibold pt-2">
                Problem Gambling? Call 1-800-522-4700
              </p>
            </div>
          </div>

          {/* Required Agreements */}
          <div className="space-y-4 mb-8">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isOver21}
                onChange={(e) => setIsOver21(e.target.checked)}
                className="mt-1 w-5 h-5 flex-shrink-0"
              />
              <span className="text-sm">
                I confirm that I am <strong>at least 21 years old</strong> and that sports betting 
                is legal in my jurisdiction.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToRisks}
                onChange={(e) => setAgreedToRisks(e.target.checked)}
                className="mt-1 w-5 h-5 flex-shrink-0"
              />
              <span className="text-sm">
                I understand that <strong>sports betting involves substantial financial risk</strong>, 
                that I can lose money, and that this service makes no guarantees about prediction accuracy.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-5 h-5 flex-shrink-0"
              />
              <span className="text-sm">
                I have read and agree to the{" "}
                <Link href="/terms" target="_blank" className="text-blue-600 hover:underline font-semibold">
                  Terms of Service
                </Link>, including the <strong>no refund policy</strong> and all disclaimers.
              </span>
            </label>
          </div>

          {/* Proceed Button */}
          <button
            onClick={() => {
              if (canProceed) {
                // Redirect to Stripe
                window.location.href = STRIPE_PAYMENT_LINK;
              }
            }}
            disabled={!canProceed}
            className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
              canProceed
                ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                : "bg-stone-300 text-stone-500 cursor-not-allowed"
            }`}
          >
            {canProceed ? "Proceed to Payment →" : "Please agree to all terms above"}
          </button>

          <p className="text-xs text-center text-stone-500 mt-4">
            Secure payment processed by Stripe • Auto-renews monthly • Cancel anytime
          </p>
        </div>

        {/* Additional Help Text */}
        <div className="text-center text-sm text-stone-600">
          <p>
            Questions? <Link href="/about#contact" className="text-blue-600 hover:underline">Contact us</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
