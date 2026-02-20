"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Mail, LogOut, X, ChevronRight } from "lucide-react";
import BBMILogo from "./BBMILogo";
import { useAuth } from "@/app/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/app/firebase-config";

// ------------------------------------------------------------
// NAV STRUCTURE — grouped by section
// ------------------------------------------------------------

const navSections = [
  {
    section: "General",
    items: [
      { name: "Home", href: "/", emoji: "🏠" },
      { name: "About", href: "/about", emoji: "📖" },
      { name: "Account", href: "/dashboard", emoji: "👤" },
      { name: "Feedback", href: "/feedback", emoji: "✉️" },
    ],
  },
  {
    section: "NCAA",
    items: [
      { name: "Rankings", href: "/ncaa-rankings", emoji: "📊" },
      { name: "Today's Picks", href: "/ncaa-todays-picks", emoji: "🎯" },
      { name: "Bracket Pulse", href: "/ncaa-bracket-pulse", emoji: "🏆" },
      { name: "Model Accuracy", href: "/ncaa-model-picks-history", emoji: "📈" },
      { name: "BBMI vs Vegas", href: "/ncaa-model-vs-vegas", emoji: "⚔️" },
    ],
  },
  {
    section: "WIAA",
    items: [
      { name: "Rankings", href: "/wiaa-rankings", emoji: "📊" },
      { name: "Today's Picks", href: "/wiaa-todays-picks", emoji: "🎯" },
      { name: "Bracket Pulse", href: "/wiaa-bracket-pulse", emoji: "🏆" },
      { name: "Winner Accuracy", href: "/wiaa-model-accuracy", emoji: "📈" },
      { name: "Line Accuracy", href: "/wiaa-line-accuracy", emoji: "📉" },
      { name: "Teams", href: "/wiaa-teams", emoji: "🏫" },
    ],
  },
];

// ------------------------------------------------------------
// MENU OVERLAY
// ------------------------------------------------------------

function MenuOverlay({ onClose, onSignOut, user }: {
  onClose: () => void;
  onSignOut: () => void;
  user: { email?: string | null } | null;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 998,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Slide-in panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(320px, 88vw)",
          backgroundColor: "#0a1a2f",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Panel header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}>
          <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.04em" }}>
            BBMI Navigation
          </span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: 6,
              padding: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav sections */}
        <div style={{ flex: 1, padding: "0.75rem 0", overflowY: "auto" }}>
          {navSections.map((section) => (
            <div key={section.section} style={{ marginBottom: "0.25rem" }}>
              {/* Section label */}
              <div style={{
                padding: "0.5rem 1.25rem 0.35rem",
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
              }}>
                {section.section}
              </div>

              {/* Section items */}
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.6rem 1.25rem",
                    color: "rgba(255,255,255,0.85)",
                    textDecoration: "none",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    transition: "background 0.15s",
                    borderRadius: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <span style={{ fontSize: "1rem", width: 22, textAlign: "center", flexShrink: 0 }}>
                    {item.emoji}
                  </span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                </Link>
              ))}

              {/* Divider between sections */}
              <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "0.5rem 1.25rem 0" }} />
            </div>
          ))}
        </div>

        {/* Footer: user info + sign out */}
        {user && (
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            padding: "0.875rem 1.25rem",
            flexShrink: 0,
          }}>
            {user.email && (
              <div style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.4)",
                marginBottom: "0.5rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {user.email}
              </div>
            )}
            <button
              onClick={() => { onSignOut(); onClose(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "rgba(220,38,38,0.15)",
                border: "1px solid rgba(220,38,38,0.4)",
                borderRadius: 6,
                color: "#fca5a5",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------
// NAVBAR
// ------------------------------------------------------------

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <nav style={{
        backgroundColor: "#f8f8f7",
        borderBottom: "1px solid #e2e0dc",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: "1600px",
          margin: "0 auto",
          padding: "0 1rem",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}>

          {/* LEFT: Hamburger + Back */}
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.65rem",
                border: "1px solid #c8c4be",
                borderRadius: 6,
                backgroundColor: isOpen ? "#e8e4de" : "#f8f8f7",
                color: "#1a1a1a",
                cursor: "pointer",
                fontSize: "0.82rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                transition: "background 0.15s",
              }}
            >
              {/* 3x3 dot grid icon */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "2.5px",
                width: 16,
                height: 16,
              }}>
                {[...Array(9)].map((_, i) => (
                  <div key={i} style={{
                    width: 3.5,
                    height: 3.5,
                    backgroundColor: "#333",
                    borderRadius: 1,
                  }} />
                ))}
              </div>
              <span className="hidden sm:inline">Menu</span>
            </button>

            <button
              onClick={() => window.history.back()}
              aria-label="Go back"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.4rem",
                border: "1px solid #c8c4be",
                borderRadius: 6,
                backgroundColor: "#f8f8f7",
                color: "#1a1a1a",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e8e4de"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#f8f8f7"; }}
            >
              <ArrowLeft size={18} />
            </button>
          </div>

          {/* CENTER: Logo */}
          <div style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%) scale(0.47)",
            transformOrigin: "center",
            pointerEvents: "auto",
          }}>
            <Link href="/" style={{ display: "flex", alignItems: "center" }}>
              <BBMILogo />
            </Link>
          </div>

          {/* RIGHT: Mail + (sign out if logged in) */}
          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            <Link
              href="/feedback"
              aria-label="Contact"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.4rem",
                border: "1px solid #c8c4be",
                borderRadius: 6,
                backgroundColor: "#f8f8f7",
                color: "#1a1a1a",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#e8e4de"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f8f8f7"; }}
            >
              <Mail size={18} />
            </Link>

            {user && (
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                title={`Sign out${user.email ? ` (${user.email})` : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.4rem",
                  border: "1px solid #fca5a5",
                  borderRadius: 6,
                  backgroundColor: "#fff1f1",
                  color: "#dc2626",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#fee2e2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff1f1"; }}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Menu Overlay (works on both mobile + desktop) */}
      {isOpen && (
        <MenuOverlay
          onClose={() => setIsOpen(false)}
          onSignOut={handleSignOut}
          user={user}
        />
      )}
    </>
  );
}
