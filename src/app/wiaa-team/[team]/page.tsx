"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";
import rankings from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import scheduleRaw from "@/data/wiaa-team/wiaa-scores.json";

import tournamentD1 from "@/data/wiaa-seeding/wiaa-d1-bracket.json";
import tournamentD2 from "@/data/wiaa-seeding/wiaa-d2-bracket.json";
import tournamentD3 from "@/data/wiaa-seeding/wiaa-d3-bracket.json";
import tournamentD4 from "@/data/wiaa-seeding/wiaa-d4-bracket.json";
import tournamentD5 from "@/data/wiaa-seeding/wiaa-d5-bracket.json";

type RankingRow = {
  division: number;
  team: string;
  record: string;
  conf_record: string;
  bbmi_rank: number | string;
  slug: string;
  primaryBadge?: string;
  secondaryBadges?: string[];
};

type TournamentTeam = {
  Team: string;
  Division: string;
  Region: string;
  WIAASeed: number;
  BBMISeed: number;
  Seed: number;
  slug: string;
  RegionalQuarter: number;
  RegionalSemis: number;
  RegionalFinals: number;
  SectionalSemi: number;
  SectionalFinal: number;
  StateQualifier: number;
  StateFinalist: number;
  StateChampion: number;
};

type RawGameRow = {
  team: string;
  teamDiv: string;
  date: string;
  opp: string;
  oppDiv: string;
  location: string;
  result: string;
  teamScore: number | string;
  oppScore: number | string;
  teamLine: number | string;
  teamWinPct: number | string;
};

type GameRow = {
  team: string;
  team_div: number;
  date: string;
  opponent: string;
  opp_div: number;
  location: string;
  result: string;
  team_score: number | string;
  opp_score: number | string;
  teamline: number | string;
  teamwinpct: number | string;
};

const slugMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), r.slug])
);
const getSlug = (team: string) => slugMap.get(team.toLowerCase()) ?? "";

const rankMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), Number(r.bbmi_rank)])
);
const getRank = (team: string): number | null => rankMap.get(team.toLowerCase()) ?? null;

const tournamentMaps = {
  1: new Map((tournamentD1 as TournamentTeam[]).map((t) => [t.Team.toLowerCase(), t])),
  2: new Map((tournamentD2 as TournamentTeam[]).map((t) => [t.Team.toLowerCase(), t])),
  3: new Map((tournamentD3 as TournamentTeam[]).map((t) => [t.Team.toLowerCase(), t])),
  4: new Map((tournamentD4 as TournamentTeam[]).map((t) => [t.Team.toLowerCase(), t])),
  5: new Map((tournamentD5 as TournamentTeam[]).map((t) => [t.Team.toLowerCase(), t])),
};

// ------------------------------------------------------------
// SHARED TABLE STYLES
// ------------------------------------------------------------

const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  padding: "8px 10px",
  textAlign: "left",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 20,
  borderBottom: "2px solid rgba(255,255,255,0.1)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const TH_RIGHT: React.CSSProperties = { ...TH, textAlign: "right" };
const TH_CENTER: React.CSSProperties = { ...TH, textAlign: "center" };

const TD: React.CSSProperties = {
  padding: "8px 10px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };
const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center" };

// ------------------------------------------------------------
// SECTION HEADING
// ------------------------------------------------------------

function SectionHeading({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0a1a2f", margin: 0 }}>{title}</h2>
      {count !== undefined && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "#78716c", backgroundColor: "#f5f5f4", borderRadius: 999, padding: "2px 8px" }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// BADGE THRESHOLD ACCORDION
// ------------------------------------------------------------

function BadgeThresholdAccordion() {
  const [open, setOpen] = useState(false);

  const thresholds = [
    { stat: "Points/Game",          primary: "≥ 75.0",  secondary: "≥ 70.0" },
    { stat: "Point Margin",         primary: "≥ 12.0",  secondary: "≥ 9.0"  },
    { stat: "FG%",                  primary: "≥ 46%",   secondary: "≥ 44%"  },
    { stat: "3PT%",                 primary: "≥ 35%",   secondary: "≥ 33%"  },
    { stat: "Assists/Game",         primary: "≥ 16.0",  secondary: "≥ 14.0" },
    { stat: "Turnovers Forced",     primary: "≥ 15.0",  secondary: "≥ 13.5" },
    { stat: "Rebounds/Game",        primary: "≥ 36.0",  secondary: "≥ 33.0" },
    { stat: "Opp FG% Allowed",      primary: "≤ 40%",   secondary: "≤ 42%"  },
    { stat: "Opp 3PT% Allowed",     primary: "≤ 32%",   secondary: "≤ 33.5%"},
    { stat: "Strength of Schedule", primary: "Top 15",  secondary: "Top 25" },
    { stat: "Quality Wins",         primary: "Top 15",  secondary: "Top 25" },
  ];

  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "1.5rem" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14,
          letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f",
          color: "#ffffff", border: "none", cursor: "pointer",
          borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s",
        }}
      >
        <span>🏅 How are badges assigned? What do they mean?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ backgroundColor: "#f9fafb", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>
            Each team receives a <strong>primary badge</strong> reflecting their most dominant statistical trait, plus up to three <strong>secondary badges</strong> for other areas of strength. Badges are assigned by comparing a team&apos;s stats against fixed thresholds — not relative to other teams.
          </p>
          <p style={{ marginBottom: 4, fontWeight: 600, color: "#1c1917" }}>
            Threshold table — what a team must achieve to earn a badge:
          </p>
          <p style={{ marginBottom: 12, fontSize: 12, color: "#78716c" }}>
            Primary = stricter threshold for the main badge. Secondary = more lenient, for supporting badges.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#0a1a2f", color: "#fff" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Stat</th>
                  <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Primary Badge</th>
                  <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Secondary Badge</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((row, i) => (
                  <tr key={row.stat} style={{ backgroundColor: i % 2 === 0 ? "#f8fafc" : "#ffffff", borderBottom: "1px solid #e7e5e4" }}>
                    <td style={{ padding: "6px 12px", fontWeight: 500, color: "#374151" }}>{row.stat}</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>{row.primary}</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", color: "#78716c" }}>{row.secondary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 12, borderTop: "1px solid #e7e5e4", paddingTop: 8 }}>
            Teams that don&apos;t meet any primary or secondary threshold receive a <strong>Balanced</strong> badge — indicating a well-rounded team without a single standout statistical profile.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = use(params);
  const teamName = decodeURIComponent(team);

  const teamInfo = useMemo(() => {
    return (rankings as RankingRow[]).find(
      (t) => t.team.toLowerCase() === teamName.toLowerCase()
    );
  }, [teamName]);

  if (!teamInfo) return notFound();

  const tournamentProbs = useMemo(() => {
    const divisionMap = tournamentMaps[teamInfo.division as keyof typeof tournamentMaps];
    if (!divisionMap) return null;
    const teamData = divisionMap.get(teamName.toLowerCase());
    if (!teamData) return null;
    return {
      RegionalQuarter: teamData.RegionalQuarter,
      RegionalSemis: teamData.RegionalSemis,
      RegionalFinals: teamData.RegionalFinals,
      SectionalSemi: teamData.SectionalSemi,
      SectionalFinal: teamData.SectionalFinal,
      StateQualifier: teamData.StateQualifier,
      StateFinalist: teamData.StateFinalist,
      StateChampion: teamData.StateChampion,
    };
  }, [teamName, teamInfo.division]);

  const normalizedGames = useMemo<GameRow[]>(() => {
    return (scheduleRaw as RawGameRow[]).map((g) => ({
      team: g.team,
      team_div: Number(g.teamDiv),
      date: g.date,
      opponent: g.opp,
      opp_div: Number(g.oppDiv),
      location: g.location,
      result: g.result,
      team_score: g.teamScore,
      opp_score: g.oppScore,
      teamline: g.teamLine,
      teamwinpct: g.teamWinPct,
    }));
  }, []);

  const games = useMemo(() => {
    return normalizedGames.filter(
      (g) =>
        g.team.toLowerCase() === teamName.toLowerCase() &&
        g.team_div === teamInfo.division
    );
  }, [teamName, normalizedGames, teamInfo.division]);

  const today = new Date().toLocaleDateString("en-CA");

  const playedGames = games.filter((g) => g.result && g.result.trim() !== "");
  const remainingGames = games.filter((g) => {
    if (g.result && g.result.trim() !== "") return false;
    const gameDate = g.date ? g.date.split(" ")[0].split("T")[0] : "";
    return gameDate >= today;
  });

  // Win/loss summary
  const wins = playedGames.filter((g) => g.result === "W").length;
  const losses = playedGames.filter((g) => g.result === "L").length;

  const resultStyle = (r: string): React.CSSProperties => ({
    fontWeight: 700,
    color: r === "W" ? "#16a34a" : r === "L" ? "#dc2626" : "#44403c",
  });

  const formatDate = (d: string) => {
    if (!d) return "";
    const isoPart = d.split(" ")[0];
    const [year, month, day] = isoPart.split("-");
    return `${month}/${day}/${year}`;
  };

  const formatPct = (v: number | string) => {
    const num = Number(v);
    if (isNaN(num)) return String(v);
    return Math.round(num * 100) + "%";
  };

  const isBlankLine = (v: number | string) =>
    v === "" || v === null || v === undefined || isNaN(Number(v));

  const OpponentCell = ({ g }: { g: GameRow }) => (
    <td style={TD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 26, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          <TeamLogo slug={getSlug(g.opponent)} size={24} />
        </div>
        <Link
          href={`/wiaa-team/${encodeURIComponent(g.opponent)}`}
          style={{ fontSize: 13, fontWeight: 500, color: "#0a1a2f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          className="hover:underline"
        >
          {g.opponent}
          {getRank(g.opponent) !== null && (
            <span style={{ marginLeft: 4, fontSize: "0.65rem", fontStyle: "italic", fontWeight: getRank(g.opponent)! <= 25 ? 700 : 400, color: getRank(g.opponent)! <= 25 ? "#dc2626" : "#78716c" }}>
              (#{getRank(g.opponent)})
            </span>
          )}
        </Link>
      </div>
    </td>
  );

  return (
    <div className="section-wrapper bg-[#f3f4f6] min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* BACK LINK */}
        <div style={{ margin: "32px 0 20px" }}>
          <Link
            href="/wiaa-rankings"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#0a1a2f", textDecoration: "none", backgroundColor: "#f9fafb", border: "1px solid #e7e5e4", borderRadius: 6, padding: "5px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            className="hover:bg-[#f3f4f6]"
          >
            ← Rankings
          </Link>
        </div>

        {/* HEADER CARD */}
        <div style={{ margin: "0 0 24px", backgroundColor: "#0a1a2f", borderRadius: 12, padding: "24px 32px", display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ flexShrink: 0, width: 90, display: "flex", justifyContent: "center" }}>
            <TeamLogo slug={teamInfo.slug} size={90} />
          </div>
          {/* divider */}
          <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
              {teamInfo.team}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#ffffff", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999 }}>
                Division {teamInfo.division}
              </span>
              <span style={{ backgroundColor: "rgba(250,204,21,0.15)", color: "#facc15", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(250,204,21,0.3)" }}>
                BBMI Rank #{teamInfo.bbmi_rank}
              </span>
              <span style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(74,222,128,0.2)" }}>
                {wins}–{losses}
                {teamInfo.conf_record ? ` (${teamInfo.conf_record} conf)` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* COMBINED CARD — Classification + Tournament Probabilities */}
        {(teamInfo.primaryBadge || tournamentProbs) && (() => {
          const BADGES: Record<string, { name: string; gradient: string; desc: string; icon: string }> = {
            'Fortress':       { name: "Fortress",       gradient: "linear-gradient(135deg, #1e3a8a, #3b82f6)", desc: "Elite point margin dominance",      icon: "M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.15-2.7 8.01-6 9.11-3.3-1.1-6-4.96-6-9.11V6.43l6-2.25z M12 9a3 3 0 100 6 3 3 0 000-6z" },
            'Lockdown':       { name: "Lockdown",       gradient: "linear-gradient(135deg, #dc2626, #f97316)", desc: "Stifling field goal defense",         icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 3.18l6 2.67v4.65c0 4.23-2.88 8.17-6 9.13-3.12-.96-6-4.9-6-9.13V6.85l6-2.67z M9 12l2 2 4-4" },
            'Arc Defenders':  { name: "Arc Defenders",  gradient: "linear-gradient(135deg, #047857, #10b981)", desc: "Elite three-point defense",           icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z M12 6v12M6 12h12" },
            'Sharpshooters':  { name: "Sharpshooters",  gradient: "linear-gradient(135deg, #7c3aed, #a855f7)", desc: "Deadly three-point shooting",         icon: "M12 10a2 2 0 100 4 2 2 0 000-4z M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" },
            'Marksmen':       { name: "Marksmen",       gradient: "linear-gradient(135deg, #be123c, #e11d48)", desc: "Overall field goal precision",        icon: "M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z M9 12l2 2 4-4" },
            'Scorchers':      { name: "Scorchers",      gradient: "linear-gradient(135deg, #ea580c, #f59e0b)", desc: "High-octane scoring offense",         icon: "M13 3L3 13l4 4 10-10-4-4z" },
            'Distributors':   { name: "Distributors",   gradient: "linear-gradient(135deg, #0891b2, #06b6d4)", desc: "Exceptional ball movement",           icon: "M3.5 6a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M15.5 6a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M9.5 12a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M6 6L12 12M18 6L12 12M12 12L6 18M12 12L18 18" },
            'Balanced':       { name: "Balanced",       gradient: "linear-gradient(135deg, #475569, #64748b)", desc: "Well-rounded excellence",             icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M8 12h8M12 8v8" },
            'Glass Cleaners': { name: "Glass Cleaners", gradient: "linear-gradient(135deg, #0f766e, #14b8a6)", desc: "Rebounding dominance",                icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z M7 10h10v4H7z" },
            'Pickpockets':    { name: "Pickpockets",    gradient: "linear-gradient(135deg, #b91c1c, #dc2626)", desc: "Turnover creation masters",           icon: "M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2z" },
            'Giant Slayers':  { name: "Giant Slayers",  gradient: "linear-gradient(135deg, #ca8a04, #eab308)", desc: "Quality wins over top teams",         icon: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" },
            'Battle-Tested':  { name: "Battle-Tested",  gradient: "linear-gradient(135deg, #334155, #475569)", desc: "Toughest strength of schedule",       icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z M12 7l2.5 5h-5z M9.5 12h5v5h-5z" },
          };

          const BadgeIcon = ({ badgeKey, size }: { badgeKey: string; size: number }) => {
            const b = BADGES[badgeKey];
            if (!b) return null;
            return (
              <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: b.gradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }} title={b.desc}>
                <svg viewBox="0 0 24 24" fill="white" style={{ width: size * 0.5, height: size * 0.5 }}>
                  <path d={b.icon} stroke="white" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            );
          };

          const primary = teamInfo.primaryBadge ? BADGES[teamInfo.primaryBadge] : null;
          const secondaries = (teamInfo.secondaryBadges ?? []).map((b) => BADGES[b]).filter(Boolean);

          const rounds = tournamentProbs ? [
            { label: "Regional Quarter", value: tournamentProbs.RegionalQuarter },
            { label: "Regional Semis",   value: tournamentProbs.RegionalSemis },
            { label: "Regional Finals",  value: tournamentProbs.RegionalFinals },
            { label: "Sectional Semi",   value: tournamentProbs.SectionalSemi },
            { label: "Sectional Final",  value: tournamentProbs.SectionalFinal },
            { label: "State Qualifier",  value: tournamentProbs.StateQualifier },
            { label: "State Final",      value: tournamentProbs.StateFinalist },
            { label: "State Champion",   value: tournamentProbs.StateChampion },
          ] : [];
          const fmtPct = (v: number) => v === 0 ? "0%" : v < 0.001 ? "<0.1%" : `${(v * 100).toFixed(1)}%`;

          return (
            <div style={{ margin: "0 0 32px", display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>

              {/* LEFT — Classification */}
              {primary && (
                <div style={{ flex: "1 1 300px", border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#f9fafb", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column" }}>
                  <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Team Classification
                  </div>
                  <div style={{ padding: "16px 20px", flex: 1 }}>
                    {/* Primary badge */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginBottom: 8 }}>Primary</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <BadgeIcon badgeKey={teamInfo.primaryBadge!} size={40} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#1c1917" }}>{primary.name}</div>
                          <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>{primary.desc}</div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary badges */}
                    {secondaries.length > 0 && (
                      <div style={{ borderTop: "1px solid #f5f5f4", paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginBottom: 10 }}>Secondary</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          {secondaries.map((b, i) => b && <BadgeIcon key={i} badgeKey={(teamInfo.secondaryBadges ?? [])[i]} size={32} />)}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {secondaries.map((b, i) => b && (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#57534e" }}>
                              <BadgeIcon badgeKey={(teamInfo.secondaryBadges ?? [])[i]} size={16} />
                              <span><strong>{b.name}:</strong> {b.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badge accordion at bottom */}
                  <div style={{ borderTop: "1px solid #f5f5f4" }}>
                    <BadgeThresholdAccordion />
                  </div>
                </div>
              )}

              {/* RIGHT — Tournament Probabilities */}
              {tournamentProbs && (
                <div style={{ flex: "1 1 240px", border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#f9fafb", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                  <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Tournament Probabilities
                  </div>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <colgroup><col /><col style={{ width: 72 }} /></colgroup>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 12px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Round</th>
                        <th style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 12px", textAlign: "right", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Prob</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rounds.map((round, i) => {
                        const isChamp = round.label === "State Champion";
                        const pct = round.value * 100;
                        const barColor = pct >= 50 ? "#16a34a" : pct >= 20 ? "#d97706" : "#d1d5db";
                        return (
                          <tr key={round.label} style={{ backgroundColor: i % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb" }}>
                            <td style={{ padding: "9px 12px", fontSize: 13, borderTop: "1px solid #f5f5f4", color: isChamp ? "#b45309" : "#1c1917" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 60, height: 4, backgroundColor: "#f3f4f6", borderRadius: 999, flexShrink: 0, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, backgroundColor: barColor, borderRadius: 999 }} />
                                </div>
                                <span style={{ fontWeight: isChamp ? 700 : 500, fontSize: 13 }}>{round.label}</span>
                              </div>
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: isChamp ? 800 : 600, borderTop: "1px solid #f5f5f4", color: isChamp ? "#b45309" : "#44403c" }}>
                              {fmtPct(round.value)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          );
        })()}

        {/* ── REMAINING GAMES ── */}
        {remainingGames.length > 0 && (
          <div style={{ margin: "0 0 40px" }}>
            <SectionHeading icon="📅" title="Remaining Games" count={remainingGames.length} />
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#f9fafb", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 90 }} />
                    <col />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 90 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={TH}>Date</th>
                      <th style={{ ...TH, textAlign: "left" }}>Opponent</th>
                      <th style={TH_CENTER}>Div</th>
                      <th style={TH_CENTER}>Location</th>
                      <th style={TH_RIGHT}>BBMI Line</th>
                      <th style={TH_RIGHT}>Win Prob</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remainingGames.map((g, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb" }}>
                        <td style={TD}>{formatDate(g.date)}</td>
                        <OpponentCell g={g} />
                        <td style={TD_CENTER}>{g.opp_div}</td>
                        <td style={TD_CENTER}>{g.location}</td>
                        <td style={TD_RIGHT}>{isBlankLine(g.teamline) ? "—" : (() => { const v = Number(g.teamline); const r = Math.round(v * 2) / 2; const x = r === Math.trunc(r) ? (r > 0 ? r - 0.5 : r + 0.5) : r; return (x > 0 ? "+" : "") + x.toFixed(1); })()}</td>
                        <td style={TD_RIGHT}>{isBlankLine(g.teamline) ? "—" : formatPct(g.teamwinpct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PLAYED GAMES ── */}
        <div style={{ margin: "0 0 40px" }}>
          <SectionHeading icon="✅" title="Played Games" count={playedGames.length} />
          <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#f9fafb", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ overflowX: "auto", maxHeight: 700, overflowY: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 90 }} />
                  <col />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={TH}>Date</th>
                    <th style={{ ...TH, textAlign: "left" }}>Opponent</th>
                    <th style={TH_CENTER}>Div</th>
                    <th style={TH_CENTER}>Location</th>
                    <th style={TH_CENTER}>Result</th>
                    <th style={TH_RIGHT}>Team</th>
                    <th style={TH_RIGHT}>Opp</th>
                  </tr>
                </thead>
                <tbody>
                  {playedGames.map((g, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb" }}>
                      <td style={TD}>{formatDate(g.date)}</td>
                      <OpponentCell g={g} />
                      <td style={TD_CENTER}>{g.opp_div}</td>
                      <td style={TD_CENTER}>{g.location}</td>
                      <td style={{ ...TD_CENTER, ...resultStyle(g.result) }}>{g.result}</td>
                      <td style={TD_RIGHT}>{g.team_score}</td>
                      <td style={TD_RIGHT}>{g.opp_score}</td>
                    </tr>
                  ))}
                  {playedGames.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...TD, textAlign: "center", color: "#78716c", fontStyle: "italic", padding: "32px 0" }}>
                        No completed games.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        </div> {/* end maxWidth 800 wrapper */}
      </div>
    </div>
  );
}
