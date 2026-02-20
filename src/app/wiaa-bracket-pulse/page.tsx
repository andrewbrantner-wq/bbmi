"use client";

import { useState } from "react";
import LogoBadge from "@/components/LogoBadge";
import WIAABracketPulseTable from "@/components/WIAABracketPulseTable";

export default function WIAABracketPulsePage() {
  const [selectedDivision, setSelectedDivision] = useState<string>("");

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* Header */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
            <LogoBadge league="wiaa" />
            <span>WIAA Tournament Seed and Result Probabilities</span>
          </h1>
        </div>

        {/* Division Selector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <label htmlFor="division-select" style={{ fontSize: 14, fontWeight: 600, color: "#44403c", marginBottom: 8 }}>
            Select Division:
          </label>
          <select
            id="division-select"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            style={{ height: 40, width: 240, fontSize: 14, borderRadius: 6, border: "1px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 10px" }}
          >
            <option value="">-- Choose Division --</option>
            <option value="1">Division 1</option>
            <option value="2">Division 2</option>
            <option value="3">Division 3</option>
            <option value="4">Division 4</option>
            <option value="5">Division 5</option>
          </select>
        </div>

        {/* Bracket Table */}
        {selectedDivision ? (
          <section style={{ width: "100%", marginTop: 48 }}>
            <WIAABracketPulseTable division={selectedDivision} />
          </section>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#78716c" }}>
            <p style={{ fontSize: 16 }}>Please select a division to view tournament bracket</p>
          </div>
        )}

      </div>
    </div>
  );
}
