"use client";

import { use } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import teamRatingsRaw from "@/data/rankings/mlb-rankings.json";

type PageProps = {
  params: Promise<{ teamName: string }>;
};

export default function MLBTeamPage({ params }: PageProps) {
  const { teamName } = use(params);
  const decoded = decodeURIComponent(teamName);
  const raw = teamRatingsRaw as Record<string, Record<string, unknown>>;
  const team = raw[decoded];

  if (!team) {
    return (
      <div className="section-wrapper">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-12 text-center">
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Team Not Found</h1>
          <p style={{ color: "#78716c", marginBottom: 24 }}>{decoded} is not in the BBMI MLB rankings.</p>
          <Link href="/mlb/rankings" style={{ color: "#2563eb", textDecoration: "underline" }}>{"\u2190"} Back to Rankings</Link>
        </div>
      </div>
    );
  }

  const bbmi = Number(team.bbmi_score ?? 100);
  const off = Number(team.off_rating ?? 100);
  const pit = Number(team.pit_rating ?? 100);
  const rank = Number(team.model_rank ?? 0);
  const record = String(team.record ?? "");
  const fip = Number(team.fip ?? 0);
  const era = Number(team.era ?? 0);
  const whip = Number(team.whip ?? 0);
  const k9 = Number(team.k_per_9 ?? 0);
  const wobaRaw = Number(team.woba_raw ?? 0);
  const wobaNeutral = Number(team.woba_neutral ?? 0);
  const ops = Number(team.ops ?? 0);
  const rpg = Number(team.runs_per_game ?? 0);
  const rapg = Number(team.runs_allowed_per_game ?? 0);
  const margin = Number(team.scoring_margin ?? 0);
  const pf = Number(team.park_factor ?? 1.0);

  const cardStyle: React.CSSProperties = {
    flex: "1 1 140px", padding: "16px 12px", textAlign: "center",
    borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff",
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

        {/* Dark hero header */}
        <div style={{ background: "#0a1628", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <Link href="/mlb/rankings" style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
            {"\u2190"} Back to Rankings
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <MLBLogo teamName={decoded} size={64} />
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#ffffff" }}>{decoded}</h1>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0" }}>
                BBMI Rank #{rank} {"\u00B7"} {record} {"\u00B7"} Park Factor: {pf.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Rating cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
          <div style={{ ...cardStyle, background: "#0a1628", border: "2px solid #0a1628" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#f0c040" }}>{bbmi.toFixed(1)}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>BBMI Score</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>100 = league avg</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: off >= 105 ? "#16a34a" : off >= 97 ? "#0a1628" : "#dc2626" }}>{off.toFixed(1)}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Offense</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>park-neutral wOBA</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: pit >= 105 ? "#16a34a" : pit >= 97 ? "#0a1628" : "#dc2626" }}>{pit.toFixed(1)}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Pitching</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>FIP-based</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: margin > 0 ? "#16a34a" : margin < 0 ? "#dc2626" : "#0a1628" }}>{margin > 0 ? "+" : ""}{margin.toFixed(2)}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Run Diff/G</div>
          </div>
        </div>

        {/* Stats grid */}
        {(() => {
          // Compute league-wide rankings for each stat (1 = best)
          const allTeams = Object.entries(raw).map(([name, t]) => ({
            name,
            runs_per_game: Number(t.runs_per_game ?? 0),
            runs_allowed_per_game: Number(t.runs_allowed_per_game ?? 0),
            fip: Number(t.fip ?? 0),
            era: Number(t.era ?? 0),
            whip: Number(t.whip ?? 0),
            k_per_9: Number(t.k_per_9 ?? 0),
            woba_raw: Number(t.woba_raw ?? 0),
            woba_neutral: Number(t.woba_neutral ?? 0),
            ops: Number(t.ops ?? 0),
            park_factor: Number(t.park_factor ?? 1.0),
          }));

          const getRank = (key: string, higher_is_better: boolean) => {
            const sorted = [...allTeams].sort((a, b) => {
              const av = (a as unknown as Record<string, number>)[key] ?? 0;
              const bv = (b as unknown as Record<string, number>)[key] ?? 0;
              return higher_is_better ? bv - av : av - bv;
            });
            const idx = sorted.findIndex(t => t.name === decoded);
            return idx >= 0 ? idx + 1 : null;
          };

          const stats = [
            { label: "Runs/Game", value: rpg.toFixed(2), good: rpg >= 4.5, rank: getRank("runs_per_game", true) },
            { label: "Runs Allowed/Game", value: rapg.toFixed(2), good: rapg <= 4.0, rank: getRank("runs_allowed_per_game", false) },
            { label: "FIP", value: fip.toFixed(2), good: fip <= 3.8, rank: getRank("fip", false) },
            { label: "ERA", value: era.toFixed(2), good: era <= 3.8, rank: getRank("era", false) },
            { label: "WHIP", value: whip.toFixed(2), good: whip <= 1.20, rank: getRank("whip", false) },
            { label: "K/9", value: k9.toFixed(1), good: k9 >= 9.0, rank: getRank("k_per_9", true) },
            { label: "wOBA (raw)", value: wobaRaw.toFixed(3), good: wobaRaw >= 0.330, rank: getRank("woba_raw", true) },
            { label: "wOBA (park-neutral)", value: wobaNeutral.toFixed(3), good: wobaNeutral >= 0.330, rank: getRank("woba_neutral", true) },
            { label: "OPS", value: ops.toFixed(3), good: ops >= 0.750, rank: getRank("ops", true) },
            { label: "Park Factor", value: pf.toFixed(2), good: null, rank: null },
          ];

          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
              {stats.map(stat => (
                <div key={stat.label} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #f1f5f9", background: "#f8fafc" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: stat.good === null ? "#1e3a5f" : stat.good ? "#16a34a" : "#dc2626" }}>{stat.value}</span>
                    {stat.rank && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: stat.rank <= 5 ? "#16a34a" : stat.rank >= 26 ? "#dc2626" : "#94a3b8" }}>
                        #{stat.rank}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Methodology note */}
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 32, backgroundColor: "#eff6ff", borderLeft: "4px solid #2563eb", borderRadius: 6, padding: "14px 18px" }}>
          <p style={{ margin: 0 }}>BBMI MLB rankings use a Negative Binomial model with FIP-based pitching, park-neutral wOBA offense, and Bayesian blending with prior-year data.</p>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            <Link href="/mlb/picks" style={{ color: "#2563eb", textDecoration: "underline" }}>View today&apos;s picks {"\u2192"}</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
