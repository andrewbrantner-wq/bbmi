"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";

// ------------------------------------------------------------
// ANIMATED CHECKMARK
// ------------------------------------------------------------
function AnimatedCheck() {
  return (
    <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 1.5rem" }}>
      <svg viewBox="0 0 80 80" style={{ width: 80, height: 80 }}>
        <circle
          cx="40" cy="40" r="36"
          fill="none" stroke="#16a34a" strokeWidth="4"
          strokeDasharray="226" strokeDashoffset="226"
          style={{ animation: "drawCircle 0.6s ease-out 0.1s forwards" }}
        />
        <polyline
          points="22,40 34,52 58,28"
          fill="none" stroke="#16a34a" strokeWidth="4"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="60" strokeDashoffset="60"
          style={{ animation: "drawCheck 0.4s ease-out 0.65s forwards" }}
        />
      </svg>
      <style>{`
        @keyframes drawCircle {
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .welcome-fade-1 { opacity: 0; animation: fadeSlideUp 0.5s ease-out 0.3s forwards; }
        .welcome-fade-2 { opacity: 0; animation: fadeSlideUp 0.5s ease-out 0.5s forwards; }
        .welcome-fade-3 { opacity: 0; animation: fadeSlideUp 0.5s ease-out 0.7s forwards; }
        .welcome-fade-4 { opacity: 0; animation: fadeSlideUp 0.5s ease-out 0.9s forwards; }
        .welcome-fade-5 { opacity: 0; animation: fadeSlideUp 0.5s ease-out 1.1s forwards; }
      `}</style>
    </div>
  );
}

// ------------------------------------------------------------
// NEXT STEPS CARD
// ------------------------------------------------------------
function NextStepCard({
  number, title, description, href, cta, delay,
}: {
  number: string; title: string; description: string;
  href: string; cta: string; delay: string;
}) {
  return (
    <div
      className={`welcome-fade-${delay}`}
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          backgroundColor: "#0a1a2f", color: "#ffffff",
          fontSize: "0.72rem", fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {number}
        </div>
        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0a1a2f" }}>{title}</span>
      </div>
      <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{description}</p>
      <Link
        href={href}
        style={{
          marginTop: "0.5rem",
          display: "inline-block",
          backgroundColor: "#0a1a2f", color: "#ffffff",
          padding: "0.45rem 1rem", borderRadius: 7,
          fontWeight: 700, fontSize: "0.78rem",
          textDecoration: "none", alignSelf: "flex-start",
        }}
      >
        {cta} →
      </Link>
    </div>
  );
}

// ------------------------------------------------------------
// MAIN CONTENT
// ------------------------------------------------------------
function WelcomePageContent() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      if (!user) { setChecking(false); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setIsPremium(userDoc.exists() && userDoc.data()?.premium === true);
      } catch {
        setIsPremium(false);
      }
      setChecking(false);
    }
    check();
  }, [user]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0a1a2f 0%, #1e293b 100%)" }}>
        <div style={{ color: "white", fontSize: "1.1rem" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f0fdf4 0%, #f8fafc 50%, #eff6ff 100%)",
      padding: "3rem 1rem 4rem",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Check + heading */}
        <div className="welcome-fade-1" style={{ textAlign: "center", marginBottom: "2rem" }}>
          <AnimatedCheck />
          <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "#0a1a2f", margin: "0 0 0.5rem", lineHeight: 1.15 }}>
            You're in. Welcome to BBMI Premium.
          </h1>
          <p style={{ fontSize: "0.95rem", color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
            {isPremium
              ? "Your account is active and ready to go."
              : "Payment confirmed — your access is being activated now."}
          </p>
          {user?.email && (
            <p style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.4rem" }}>
              Signed in as <strong>{user.email}</strong>
            </p>
          )}
        </div>

        {/* Stats strip */}
        <div
          className="welcome-fade-2"
          style={{
            backgroundColor: "#0a1a2f", borderRadius: 12,
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            marginBottom: "2rem", overflow: "hidden",
          }}
        >
          {[
            { value: "58.8%", label: "Beat Vegas", sub: "all picks" },
            { value: "65.5%", label: "High-edge picks", sub: "edge ≥ 5 pts" },
            { value: "1,664+", label: "Games tracked", sub: "full history" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "1rem 0.5rem", textAlign: "center",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>{s.label}</div>
              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Next steps */}
        <div className="welcome-fade-3" style={{ marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", margin: "0 0 0.75rem" }}>
            Where to start
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
          <NextStepCard
            number="1" delay="3"
            title="Today's Picks"
            description="View all of today's NCAA picks including high-edge picks (≥5 pts) — historically 65%+ accurate. Use the Edge filter to focus on the model's strongest calls."
            href="/ncaa-todays-picks"
            cta="See today's picks"
          />
          <NextStepCard
            number="2" delay="4"
            title="Model Accuracy History"
            description="Browse the full documented track record — every pick, result, and ROI logged publicly. Filter by edge size to see how accuracy improves on high-conviction picks."
            href="/ncaa-model-picks-history"
            cta="View pick history"
          />
          <NextStepCard
            number="3" delay="5"
            title="Manage Your Subscription"
            description="View your account status, billing details, or cancel anytime from your dashboard."
            href="/dashboard"
            cta="Go to dashboard"
          />
        </div>

        {/* Pro tip */}
        <div
          className="welcome-fade-5"
          style={{
            backgroundColor: "#fefce8", border: "1px solid #fde68a",
            borderRadius: 10, padding: "1rem 1.25rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#92400e", marginBottom: "0.35rem" }}>
            💡 Pro tip
          </div>
          <p style={{ fontSize: "0.82rem", color: "#78350f", margin: 0, lineHeight: 1.55 }}>
            Filter Today's Picks to <strong>Edge ≥ 5 pts</strong> to focus on the games where BBMI most strongly disagrees with Vegas. That's where the model has historically performed best — and it's the first thing most subscribers do each morning.
          </p>
        </div>

      </div>
    </div>
  );
}

// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------
export default function WelcomePage() {
  return (
    <AuthProvider>
      <WelcomePageContent />
    </AuthProvider>
  );
}
