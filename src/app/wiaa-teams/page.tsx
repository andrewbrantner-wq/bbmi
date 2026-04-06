"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import wiaaData from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
// LogoBadge removed — warm design uses sport pill instead
import TeamLogo from "@/components/TeamLogo";

type WIAARow = {
  division: number;
  team: string;
  record: string;
  bbmi_rank: number;
  slug: string;
};

const TH: React.CSSProperties = {
  backgroundColor: "#8b3a3a",
  color: "#ffffff",
  padding: "8px 14px",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "2px solid rgba(255,255,255,0.1)",
};

const TD: React.CSSProperties = {
  padding: "8px 14px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  verticalAlign: "middle",
};

export default function WIAATeamsPage() {
  const [division, setDivision] = useState(1);

  const normalized = useMemo<WIAARow[]>(() => {
    const raw = wiaaData as any[];
    return raw.map((r) => ({
      division: Number(r.division),
      team: String(r.team ?? ""),
      record: String(r.record ?? ""),
      bbmi_rank: Number(r.bbmi_rank ?? r.ranking ?? 0),
      slug: String(r.slug ?? ""),
    }));
  }, []);

  const divisions = useMemo(() => {
    const set = new Set<number>();
    normalized.forEach((t) => { if (!Number.isNaN(t.division)) set.add(t.division); });
    return Array.from(set).sort((a, b) => a - b);
  }, [normalized]);

  const filtered = useMemo(() => normalized.filter((t) => t.division === division), [normalized, division]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => a.team.localeCompare(b.team)), [filtered]);

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full mx-auto px-6 py-8" style={{ maxWidth: "1100px" }}>

        {/* Header */}
        <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid #d4d2cc", marginBottom: 24 }}>
          <div style={{ backgroundColor: "#8b3a3a", color: "#ffffff", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 14px", borderRadius: 999, marginBottom: 10 }}>
            WIAA Basketball
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: 0, textAlign: "center" }}>
            Teams
          </h1>
          <p style={{ fontSize: 13, color: "#78716c", margin: "6px 0 0" }}>Click any team for their full profile</p>
        </div>

        {/* Division Filter */}
        <div style={{ maxWidth: 400, margin: "0 auto 24px", display: "flex", justifyContent: "center" }}>
          <select
            value={division}
            onChange={(e) => setDivision(Number(e.target.value))}
            style={{ height: 36, fontSize: 14, borderRadius: 6, border: "1px solid #d6d3d1", backgroundColor: "#f9fafb", color: "#1c1917", padding: "0 10px" }}
          >
            {divisions.map((d) => (
              <option key={d} value={d}>Division {d}</option>
            ))}
          </select>
        </div>

        {/* Teams Table */}
        <div style={{ maxWidth: 400, margin: "0 auto 40px" }}>
          <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "70%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Team</th>
                  <th style={{ ...TH, textAlign: "right" }}>Record</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, index) => (
                  <tr key={`${row.team}-${row.bbmi_rank}`} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ minWidth: 32, display: "flex", justifyContent: "center" }}>
                          <TeamLogo slug={row.slug} size={28} />
                        </div>
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(row.team)}`}
                          style={{ fontWeight: 600, color: "#8b3a3a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          className="hover:underline"
                        >
                          {row.team}
                        </Link>
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", color: "#57534e" }}>
                      {row.record || "—"}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>
                      No teams found for this division.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
