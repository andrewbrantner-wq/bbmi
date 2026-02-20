"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import wiaaData from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import LogoBadge from "@/components/LogoBadge";
import TeamLogo from "@/components/TeamLogo";

type WIAARow = {
  division: number;
  team: string;
  record: string;
  bbmi_rank: number;
  slug: string;
};

const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
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
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* Header */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
            <LogoBadge league="wiaa" />
            Click School Name for Boys Varsity Team Page
          </h1>
        </div>

        {/* Division Filter */}
        <div style={{ maxWidth: 400, margin: "0 auto 24px", display: "flex", justifyContent: "center" }}>
          <select
            value={division}
            onChange={(e) => setDivision(Number(e.target.value))}
            style={{ height: 36, fontSize: 14, borderRadius: 6, border: "1px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 10px" }}
          >
            {divisions.map((d) => (
              <option key={d} value={d}>Division {d}</option>
            ))}
          </select>
        </div>

        {/* Teams Table */}
        <div style={{ maxWidth: 400, margin: "0 auto 40px" }}>
          <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
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
                  <tr key={`${row.team}-${row.bbmi_rank}`} style={{ backgroundColor: index % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ minWidth: 32, display: "flex", justifyContent: "center" }}>
                          <TeamLogo slug={row.slug} size={28} />
                        </div>
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(row.team)}`}
                          style={{ fontWeight: 600, color: "#0a1a2f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
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
