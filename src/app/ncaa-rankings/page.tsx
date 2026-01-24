"use client";

console.log("RANKINGS PAGE RENDERED");

import { useState, useMemo, useRef, useEffect } from "react";
import rankingsData from "@/data/rankings/rankings.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BBMILogo from "@/components/BBMILogo";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Typed shape for a single ranking row.
 * Use union types for numeric fields to accept either numbers or strings
 * coming from the CSV/JSON source, then normalize/parse as needed in comparators.
 */
type Ranking = {
  team: string;
  conference: string;
  model_rank: number | string;
  kenpom_rank: number | string;
  net_ranking: number | string;
  last_ten: string;
  record: string;
};

export default function RankingsPage() {
  const [sortColumn, setSortColumn] = useState<keyof Ranking>("model_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");


  // Sticky column measurement refs
const rankRef = useRef<HTMLTableCellElement>(null);
const rankHeaderRef = useRef<HTMLTableCellElement>(null);
const [rankWidth, setRankWidth] = useState(0);
const [lastUpdated, setLastUpdated] = useState("");

useEffect(() => {
  fetch("/data/rankings/last_updated.txt")
    .then((res) => res.text())
    .then((txt) => setLastUpdated(txt.trim()))
    .catch(() => setLastUpdated("Unknown"));
}, []);

const normalizedRankings = useMemo<Ranking[]>(() => {
  const raw = rankingsData as unknown;
  if (!Array.isArray(raw)) return [];

  const possibleTeamKeys = ["team", "Team", "name", "team_name", "teamName"];

  const parseNum = (v: unknown): number | string => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : v;
    }
    return "";
  };

  return (raw as unknown[]).map((row, idx): Ranking => {
    const r = row as Record<string, unknown>;

    // find team value from several possible keys
    let teamVal: unknown = "";
    for (const k of possibleTeamKeys) {
      if (k in r && r[k] != null && String(r[k]).trim() !== "") {
        teamVal = r[k];
        break;
      }
    }

    if (!teamVal || String(teamVal).trim() === "") {
      console.warn(`rankings: missing team name at row ${idx}`, r);
    }

    return {
      team: String(teamVal ?? ""),
      conference: String(r.conference ?? r.Conference ?? ""),
      model_rank: parseNum(r.model_rank ?? r.modelRank ?? r["Model Rank"]),
      kenpom_rank: parseNum(r.kenpom_rank ?? r.kenpomRank ?? r.kenpom),
      net_ranking: parseNum(r.net_ranking ?? r.netRanking ?? r.net),
      last_ten: String(r.last_ten ?? r.lastTen ?? ""),
      record: String(r.record ?? ""),
    };
  });
}, []);

  const getRankTextColor = (value: number | string) => {
    const num = Number(value);
    if (isNaN(num)) return "font-mono text-stone-800";
    const ratio = Math.min(Math.max((num - 1) / 199, 0), 1);
    const r = Math.floor(255 * ratio);
    const g = Math.floor(180 * (1 - ratio) + 75 * ratio);
    return `font-mono text-[rgb(${r},${g},80)] font-medium tracking-tightest`;
  };

  const getLastTenTextColor = (record: string) => {
    if (!record || !record.includes("-")) return "font-mono text-stone-800";
    const [wins, losses] = record.split("-").map(Number);
    const total = wins + losses || 1;
    const ratio = wins / total;
    const r = Math.floor(255 * (1 - ratio));
    const g = Math.floor(200 * ratio + 30 * (1 - ratio));
    return `font-mono text-[rgb(${r},${g},80)] font-medium tracking-tightest`;
  };

  const getLastTenBarStyle = (record: string) => {
    if (!record || !record.includes("-")) return { width: "0%" };
    const [wins, losses] = record.split("-").map(Number);
    const total = wins + losses || 1;
    const ratio = wins / total;
    return { width: `${Math.round(ratio * 100)}%` };
  };

  const conferences = useMemo(() => {
    const set = new Set<string>();
    normalizedRankings.forEach((t) => set.add(t.conference));
    return Array.from(set).sort();
  }, [normalizedRankings]);

  const handleSort = (column: keyof Ranking) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Replace your sortIcon function with this (ensures icons are white)
  const sortIcon = (column: keyof Ranking) => {
    if (column !== sortColumn) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline-block w-4 h-4 ml-1 text-white" />
    ) : (
      <ChevronDown className="inline-block w-4 h-4 ml-1 text-white" />
    );
  };

  const filteredRankings = useMemo(() => {
    const q = search.toLowerCase();
    return normalizedRankings.filter((team) => {
      const matchesSearch =
        team.team.toLowerCase().includes(q) ||
        team.conference.toLowerCase().includes(q) ||
        String(team.model_rank).includes(q) ||
        String(team.kenpom_rank).includes(q) ||
        String(team.net_ranking).includes(q) ||
        (team.last_ten || "").toLowerCase().includes(q);

      const matchesConference =
        conferenceFilter === "all" || team.conference === conferenceFilter;

      return matchesSearch && matchesConference;
    });
  }, [search, conferenceFilter, normalizedRankings]);

  /**
   * Type-safe comparator that treats known numeric columns as numbers,
   * parses `record` specially (wins-losses), and falls back to string compare.
   */
  const compareRankings = (a: Ranking, b: Ranking) => {
    const key = sortColumn;

    // Numeric columns
    if (key === "model_rank" || key === "kenpom_rank" || key === "net_ranking") {
      const va = Number(a[key]);
      const vb = Number(b[key]);
      if (!isNaN(va) && !isNaN(vb)) {
        return sortDirection === "asc" ? va - vb : vb - va;
      }
      // If one or both are NaN, fall back to string compare
      return sortDirection === "asc"
        ? String(a[key]).localeCompare(String(b[key]))
        : String(b[key]).localeCompare(String(a[key]));
    }

    // Special handling for record like "12-3" (sort by wins then losses)
    if (key === "record") {
      const parseRecord = (r: string) => {
        const [winsRaw, lossesRaw] = (r || "").split("-");
        const wins = Number(winsRaw ?? NaN);
        const losses = Number(lossesRaw ?? NaN);
        return {
          wins: Number.isFinite(wins) ? wins : -1,
          losses: Number.isFinite(losses) ? losses : 9999,
        };
      };
      const ra = parseRecord(a.record);
      const rb = parseRecord(b.record);
      if (ra.wins !== rb.wins) {
        return sortDirection === "asc" ? ra.wins - rb.wins : rb.wins - ra.wins;
      }
      return sortDirection === "asc" ? ra.losses - rb.losses : rb.losses - ra.losses;
    }

    // Default: string compare for team, conference, last_ten, etc.
    const sa = String(a[key] ?? "");
    const sb = String(b[key] ?? "");
    return sortDirection === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
  };

const sortedRankings = useMemo(() => {
  return [...filteredRankings].sort((a: Ranking, b: Ranking) => {
    const key = sortColumn;

    // Numeric columns
    if (key === "model_rank" || key === "kenpom_rank" || key === "net_ranking") {
      const numA = Number(a[key]);
      const numB = Number(b[key]);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      // fallback to string compare if not numeric
      return sortDirection === "asc"
        ? String(a[key]).localeCompare(String(b[key]))
        : String(b[key]).localeCompare(String(a[key]));
    }

    // Special handling for record like "12-3"
    if (key === "record") {
      const parseRecord = (r: string) => {
        const [w, l] = (r || "").split("-");
        const wins = Number(w ?? NaN);
        const losses = Number(l ?? NaN);
        return {
          wins: Number.isFinite(wins) ? wins : -1,
          losses: Number.isFinite(losses) ? losses : 9999,
        };
      };
      const ra = parseRecord(a.record);
      const rb = parseRecord(b.record);
      if (ra.wins !== rb.wins) {
        return sortDirection === "asc" ? ra.wins - rb.wins : rb.wins - ra.wins;
      }
      return sortDirection === "asc" ? ra.losses - rb.losses : rb.losses - ra.losses;
    }

    // Default string compare for team, conference, last_ten, etc.
    const sa = String(a[key] ?? "");
    const sb = String(b[key] ?? "");
    return sortDirection === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}, [filteredRankings, sortColumn, sortDirection]);

  const totalTeams = normalizedRankings.length;
  const visibleTeams = sortedRankings.length;

/* INSERTED BLOCK — THIS IS THE CORRECT LOCATION */
useEffect(() => {
  const measure = () => {
    const w1 = rankRef.current?.offsetWidth ?? 0;
    const w2 = rankHeaderRef.current?.offsetWidth ?? 0;
    setRankWidth(Math.max(w1, w2));
  };

  measure();
  window.addEventListener("resize", measure);
  return () => window.removeEventListener("resize", measure);
}, [sortedRankings]);
/* END INSERTED BLOCK */


 return (
  <div className="mt-16 w-full max-w-[1600px] mx-auto px-6 py-8">

    {/* Header */}
    <div className="mt-10 flex flex-col items-center mb-6">
      
      <BBMILogo />

      <h1 className="text-3xl font-bold tracking-tightest leading-tight">
        NCAA | Team Rankings
      </h1>
     
    </div>

    {/* Controls */}
    <div className="mb-6 flex flex-col gap-3">
      <Input
        placeholder="Search teams, conferences, rankings..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-64 text-sm tracking-tight"
      />

<select
  value={conferenceFilter}
  onChange={(e) => setConferenceFilter(e.target.value)}
  className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
>
  <option value="all">All conferences</option>
  {conferences.map((conf) => (
    <option key={conf} value={conf}>
      {conf}
    </option>
  ))}
</select>


      <Button
        variant="outline"
        className="h-9 w-32 text-sm tracking-tight"
        onClick={() => {
          setSearch("");
          setConferenceFilter("all");
          setSortColumn("model_rank");
          setSortDirection("asc");
        }}
      >
        Reset
      </Button>

      <div className="text-sm text-stone-600 tracking-tight">
   
        <div className="text-sm text-stone-600 tracking-tight">
  Showing <span className="font-semibold">{visibleTeams}</span> of{" "}
  <span className="font-semibold">{totalTeams}</span> teams. Updated rankings as of {lastUpdated}
</div>
      </div>
    </div>

{/* Rankings Table */}
<div className="section-wrapper">
<div className="rankings-table">
  <div className="rankings-scroll">

    <table>
      <thead>
        <tr>
          {/* Sticky Rank */}
          <th
            ref={rankHeaderRef}
            className="sticky left-0 z-30 cursor-pointer select-none"
            onClick={() => handleSort("model_rank")}
          >
            BBMI Rank
            {sortIcon("model_rank") && (
              <span className="inline-block ml-1">{sortIcon("model_rank")}</span>
            )}
          </th>

          {/* Sticky Team */}
          <th
            className="sticky z-30 cursor-pointer select-none"
            style={{ left: rankWidth }}
            onClick={() => handleSort("team")}
          >
            Team
            {sortIcon("team") && (
              <span className="inline-block ml-1">{sortIcon("team")}</span>
            )}
          </th>

          <th
            className="cursor-pointer select-none"
            onClick={() => handleSort("conference")}
          >
            Conference
            {sortIcon("conference") && (
              <span className="inline-block ml-1">{sortIcon("conference")}</span>
            )}
          </th>

          <th
            className="cursor-pointer select-none text-right"
            onClick={() => handleSort("kenpom_rank")}
          >
            KenPom
            {sortIcon("kenpom_rank") && (
              <span className="inline-block ml-1">{sortIcon("kenpom_rank")}</span>
            )}
          </th>

          <th
            className="cursor-pointer select-none text-right"
            onClick={() => handleSort("net_ranking")}
          >
            NET
            {sortIcon("net_ranking") && (
              <span className="inline-block ml-1">{sortIcon("net_ranking")}</span>
            )}
          </th>

          <th
            className="cursor-pointer select-none text-right"
            onClick={() => handleSort("record")}
          >
            Record
            {sortIcon("record") && (
              <span className="inline-block ml-1">{sortIcon("record")}</span>
            )}
          </th>
        </tr>
      </thead>

      <tbody>
        {sortedRankings.map((team, index) => (
          <tr
            key={`${team.team}-${team.model_rank}`}
            className={index % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
          >
            {/* Sticky Rank */}
            <td
              ref={index === 0 ? rankRef : null}
              className="sticky left-0 z-20 bg-white/90 backdrop-blur-sm font-mono text-sm"
            >
              {team.model_rank}
            </td>

            {/* Sticky Team */}
            <td
              className="sticky z-20 bg-white/90 backdrop-blur-sm font-medium text-stone-900 whitespace-nowrap"
              style={{ left: rankWidth }}
            >
              {team.team}
            </td>

            <td className="whitespace-nowrap text-stone-700">
              {team.conference}
            </td>

            <td className="whitespace-nowrap text-right">
              <span className={getRankTextColor(team.kenpom_rank)}>
                {team.kenpom_rank}
              </span>
            </td>

            <td className="whitespace-nowrap text-right">
              <span className={getRankTextColor(team.net_ranking)}>
                {team.net_ranking}
              </span>
            </td>

            <td className="whitespace-nowrap text-right font-mono text-sm text-stone-700">
              {team.record || "—"}
            </td>
          </tr>
        ))}

        {sortedRankings.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center py-6 text-stone-500">
              No teams match your filters.
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
