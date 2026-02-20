"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";
import { WIAATeamBadges } from "@/components/WIAATeamBadge";
import WIAATournamentTable from "@/components/WIAATournamentTable";
import rankings from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import scheduleRaw from "@/data/wiaa-team/WIAA-team.json";

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
  RegionalSemis: number;
  RegionalChampion: number;
  SectionalSemiFinalist: number;
  SectionalFinalist: number;
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
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
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
      RegionalSemis: teamData.RegionalSemis,
      RegionalChampion: teamData.RegionalChampion,
      SectionalSemiFinalist: teamData.SectionalSemiFinalist,
      SectionalFinalist: teamData.SectionalFinalist,
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

  // Filter by BOTH team name AND division to handle duplicate school names (e.g. Valley Christian D4 vs D5)
  const games = useMemo(() => {
    return normalizedGames.filter(
      (g) =>
        g.team.toLowerCase() === teamName.toLowerCase() &&
        g.team_div === teamInfo.division
    );
  }, [teamName, normalizedGames, teamInfo.division]);

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  const playedGames = games.filter((g) => g.result && g.result.trim() !== "");
  const remainingGames = games.filter((g) => {
    if (g.result && g.result.trim() !== "") return false;
    const gameDate = g.date ? g.date.split(" ")[0].split("T")[0] : "";
    return gameDate >= today;
  });

  const resultStyle = (r: string): React.CSSProperties => ({
    fontWeight: 600,
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
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* HEADER */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <TeamLogo slug={teamInfo.slug} size={120} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#57534e", letterSpacing: "-0.01em", textAlign: "center" }}>
            D{teamInfo.division} | BBMI Rank {teamInfo.bbmi_rank} | {teamInfo.record}
            {teamInfo.conf_record && ` (${teamInfo.conf_record})`}
          </h1>
        </div>

        {/* BACK LINK */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/wiaa-rankings" style={{ fontSize: 14, color: "#2563eb" }} className="hover:underline">
            ← Back to Rankings
          </Link>
        </div>

        {/* TEAM BADGES */}
        {teamInfo.primaryBadge && (
          <WIAATeamBadges
            primaryBadge={teamInfo.primaryBadge}
            secondaryBadges={teamInfo.secondaryBadges}
          />
        )}

        {/* BADGE ACCORDION */}
        {teamInfo.primaryBadge && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <BadgeThresholdAccordion />
          </div>
        )}

        {/* TOURNAMENT PROBABILITIES */}
        {tournamentProbs && (
          <WIAATournamentTable
            division={teamInfo.division}
            probabilities={tournamentProbs}
          />
        )}

        {/* ── REMAINING GAMES ── */}
        {remainingGames.length > 0 && (
          <div style={{ maxWidth: 800, margin: "0 auto 40px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Remaining Games</h2>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
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
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={TD}>{formatDate(g.date)}</td>
                        <OpponentCell g={g} />
                        <td style={TD_CENTER}>{g.opp_div}</td>
                        <td style={TD_CENTER}>{g.location}</td>
                        <td style={TD_RIGHT}>{isBlankLine(g.teamline) ? "—" : String(g.teamline)}</td>
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
        <div style={{ maxWidth: 800, margin: "0 auto 40px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Played Games</h2>
          <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ overflowX: "auto" }}>
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
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
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

      </div>
    </div>
  );
}
