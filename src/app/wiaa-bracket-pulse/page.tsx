"use client";

import { useState } from "react";
import Link from "next/link";
// LogoBadge removed — warm design uses sport pill instead
import WIAABracketPulseTable from "@/components/WIAABracketPulseTable";

export default function WIAABracketPulsePage() {
  const [selectedDivision, setSelectedDivision] = useState<string>("1");

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full mx-auto px-6 py-8" style={{ maxWidth: "1100px" }}>

        {/* Header */}
        <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid #d4d2cc", marginBottom: 24 }}>
          <div style={{ backgroundColor: "#8b3a3a", color: "#ffffff", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 14px", borderRadius: 999, marginBottom: 10 }}>
            WIAA Basketball
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: 0, textAlign: "center" }}>
            Tournament Probabilities
          </h1>
          <p style={{ fontSize: 13, color: "#78716c", margin: "6px 0 0" }}>Seed and result probabilities by division</p>
        </div>

        {/* Division Pills */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>Select Division:</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["1","2","3","4","5"].map((d) => {
              const isActive = selectedDivision === d;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDivision(d)}
                  style={{
                    height: 34, padding: "0 18px", borderRadius: 999,
                    border: isActive ? "2px solid #8b3a3a" : "2px solid #d6d3d1",
                    backgroundColor: isActive ? "#8b3a3a" : "#ffffff",
                    color: isActive ? "#ffffff" : "#44403c",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: isActive ? "0 2px 8px rgba(139,58,58,0.18)" : "none",
                    transition: "all 0.12s ease",
                  }}
                >
                  Division {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* STATE TOURNAMENT LINK */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <Link
            href="/wiaa-state-tournament"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#8b3a3a",
              color: "#ffffff", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8, padding: "0.55rem 1.25rem",
              fontSize: "0.82rem", fontWeight: 700, textDecoration: "none",
              letterSpacing: "0.03em",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            🏆 State Tournament Probabilities →
          </Link>
        </div>

        {/* Bracket Table */}
        <section style={{ width: "100%", marginTop: 48 }}>
          <WIAABracketPulseTable division={selectedDivision} />
        </section>

      </div>
    </div>
  );
}
