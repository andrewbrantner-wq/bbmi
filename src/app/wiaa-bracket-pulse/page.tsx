"use client";

import { useState } from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import WIAABracketPulseTable from "@/components/WIAABracketPulseTable";

export default function WIAABracketPulsePage() {
  const [selectedDivision, setSelectedDivision] = useState<string>("1");

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

        {/* Header */}
        <div style={{ background: "#0a1628", borderRadius: 0, padding: "32px 24px", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff", margin: 0, textAlign: "center" }}>
            <LogoBadge league="wiaa" size={48} />
            <span>WIAA Tournament Probabilities</span>
          </h1>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0" }}>Seed and result probabilities by division</p>
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
                    border: isActive ? "2px solid #0a1a2f" : "2px solid #d6d3d1",
                    backgroundColor: isActive ? "#0a1a2f" : "#ffffff",
                    color: isActive ? "#ffffff" : "#44403c",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: isActive ? "0 2px 8px rgba(10,26,47,0.18)" : "none",
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
              background: "linear-gradient(135deg, #0a1a2f, #0d2440)",
              color: "#facc15", border: "1px solid rgba(250,204,21,0.35)",
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
