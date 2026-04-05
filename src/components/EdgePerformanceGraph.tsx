"use client";

import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* -------------------------------------------------------
   TYPES
-------------------------------------------------------- */
type Game = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: string | number | null;
  fakeWin: number | null;
  vegasTotal?: number | null;
  bbmiTotal?: number | null;
  totalPick?: string | null;
  totalResult?: string | null;
  actualTotal?: number | null;
};

type EdgeCategory = {
  name: string;
  min: number;
  max: number;
  color: string;
  width: number;
};

type DataPoint = {
  label: string;
  [key: string]: string | number | null;
};

type Props = {
  games: Game[];
  /** "week" (default) groups by rolling 7-day windows.
   *  "biweek" groups by rolling 14-day windows.
   *  "month" groups by calendar month — better for football with fewer games. */
  groupBy?: "week" | "biweek" | "month";
  /** Limit to the last N periods (weeks or months). Null = show all. */
  periodsToShow?: number | null;
  showTitle?: boolean;
  /** Override the default edge bucket definitions. */
  edgeCategories?: EdgeCategory[];
  /** Which category names are visible by default. */
  defaultVisible?: string[];
  /** "ats" (default) uses spread edge/fakeWin. "ou" uses total edge/totalResult. */
  mode?: "ats" | "ou";
};

/* -------------------------------------------------------
   EDGE CATEGORY PRESETS
   Export these so callers can pass them via the edgeCategories prop.
-------------------------------------------------------- */
export const FOOTBALL_EDGE_CATEGORIES: EdgeCategory[] = [
  { name: "0–3 pts",  min: 0,  max: 3,        color: "#475569", width: 1.0  },
  { name: "3–6 pts",  min: 3,  max: 6,        color: "#64748b", width: 1.25 },
  { name: "6–9 pts",  min: 6,  max: 9,        color: "#3b82f6", width: 1.75 },
  { name: "9–12 pts", min: 9,  max: 12,       color: "#f97316", width: 2.5  },
  { name: "12+ pts",  min: 12, max: Infinity, color: "#22c55e", width: 3.0  },
];

export const BASKETBALL_EDGE_CATEGORIES: EdgeCategory[] = [
  { name: "2–4 pts", min: 2, max: 4,        color: "#475569", width: 1.0  },
  { name: "4–6 pts", min: 4, max: 6,        color: "#64748b", width: 1.5  },
  { name: "6–8 pts", min: 6, max: 8,        color: "#3b82f6", width: 2.0  },
  { name: ">8 pts",  min: 8, max: Infinity, color: "#22c55e", width: 3.0  },
];

// Default (used when no edgeCategories prop is passed)
const DEFAULT_EDGE_CATEGORIES = FOOTBALL_EDGE_CATEGORIES;

/* -------------------------------------------------------
   CUSTOM TOOLTIP
-------------------------------------------------------- */
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string; payload: DataPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const validEntries = payload.filter(
    (e) => e.value !== null && Number(e.payload[`${e.name}_count`]) > 0
  );
  if (!validEntries.length) return null;

  return (
    <div style={{
      backgroundColor: "#ffffff",
      border: "1px solid #d4d2cc",
      borderRadius: 8,
      padding: "10px 14px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      minWidth: 180,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888888", marginBottom: 8 }}>
        {label}
      </div>
      {validEntries.map((entry) => {
        const count = entry.payload[`${entry.name}_count`] as number;
        return (
          <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: entry.color }} />
              <span style={{ fontSize: 12, color: "#444444" }}>{entry.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: entry.color }}>{entry.value?.toFixed(1)}%</span>
              <span style={{ fontSize: 10, color: "#aaaaaa" }}>({count}g)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------
   HELPER — build a DataPoint from a bucket of games
-------------------------------------------------------- */
function buildDataPoint(label: string, bucketGames: Game[], cats: EdgeCategory[], mode: "ats" | "ou" = "ats"): DataPoint {
  const dp: DataPoint = { label };
  cats.forEach((cat) => {
    const cg = bucketGames.filter((g) => {
      const e = mode === "ou"
        ? Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0))
        : Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
      return e >= cat.min && e < cat.max;
    });
    const wins = mode === "ou"
      ? cg.filter((g) => g.totalPick != null && g.totalPick === g.totalResult).length
      : cg.filter((g) => Number(g.fakeWin) > 0).length;
    dp[cat.name] = cg.length > 0
      ? parseFloat(((wins / cg.length) * 100).toFixed(1))
      : null;
    dp[`${cat.name}_count`] = cg.length;
  });
  return dp;
}

/* -------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------- */
const EdgePerformanceGraph: React.FC<Props> = ({
  games,
  groupBy = "week",
  periodsToShow = null,
  showTitle = true,
  edgeCategories = DEFAULT_EDGE_CATEGORIES,
  defaultVisible,
  mode = "ats",
}) => {
  const allCategoryNames = edgeCategories.map((c) => c.name);
  const [visibleCategories, setVisibleCategories] = React.useState<string[]>(
    defaultVisible ?? allCategoryNames
  );

  // Reset visible categories when edge categories change (e.g. ATS -> O/U)
  const catKey = allCategoryNames.join(",");
  const prevCatKey = React.useRef(catKey);
  React.useEffect(() => {
    if (prevCatKey.current !== catKey) {
      setVisibleCategories(defaultVisible ?? allCategoryNames);
      prevCatKey.current = catKey;
    }
  }, [catKey, defaultVisible, allCategoryNames]);

  const toggleCategory = (name: string) => {
    setVisibleCategories((prev) =>
      prev.includes(name)
        ? prev.length === 1 ? prev : prev.filter((c) => c !== name)
        : [...prev, name]
    );
  };

  const chartData = useMemo(() => {
    if (!games?.length) return [];

    const completed = games.filter(
      (g) =>
        g.actualHomeScore !== null &&
        g.actualAwayScore !== null &&
        (mode === "ou"
          ? (g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.totalResult != null)
          : Number(g.fakeBet) > 0)
    );
    if (!completed.length) return [];

    // ── MONTH grouping ──────────────────────────────────
    if (groupBy === "month") {
      const byMonth: Record<string, Game[]> = {};
      completed.forEach((g) => {
        if (!g.date) return;
        const key = g.date.split("T")[0].split(" ")[0].slice(0, 7); // "YYYY-MM"
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(g);
      });
      const sorted = Object.keys(byMonth).sort();
      const toProcess = periodsToShow ? sorted.slice(-periodsToShow) : sorted;
      return toProcess.map((key) => {
        const [year, month] = key.split("-");
        const displayLabel = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        return buildDataPoint(displayLabel, byMonth[key], edgeCategories, mode);
      });
    }

    // ── WEEK / BIWEEK grouping (default) ─────────────────
    const windowDays = groupBy === "biweek" ? 14 : 7;

    const allDates = completed
      .map((g) => (g.date ? g.date.split("T")[0].split(" ")[0] : null))
      .filter((d): d is string => d !== null)
      .sort();

    if (!allDates.length) return [];

    const addDays = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };

    const byPeriod: Record<number, Game[]> = {};
    let cur = allDates[0];
    let periodNum = 1;
    while (cur <= allDates[allDates.length - 1]) {
      const end = addDays(cur, windowDays - 1);
      const pg = completed.filter((g) => {
        if (!g.date) return false;
        const d = g.date.split("T")[0].split(" ")[0];
        return d >= cur && d <= end;
      });
      if (pg.length > 0) byPeriod[periodNum] = pg;
      cur = addDays(cur, windowDays);
      periodNum++;
    }

    const sorted = Object.keys(byPeriod)
      .map(Number)
      .filter((w) => w >= 1)
      .sort((a, b) => a - b);

    const toProcess = periodsToShow ? sorted.slice(-periodsToShow) : sorted;
    return toProcess.map((period, i) => {
      const startDate = addDays(allDates[0], (period - 1) * windowDays);
      const endDate = addDays(startDate, windowDays - 1);
      const fmt = (d: string) => {
        const [, m, day] = d.split("-");
        return `${new Date(0, Number(m) - 1).toLocaleString("en-US", { month: "short" })} ${Number(day)}`;
      };
      return buildDataPoint(`${fmt(startDate)}–${fmt(endDate)}`, byPeriod[period], edgeCategories, mode);
    });

  }, [games, groupBy, periodsToShow, edgeCategories]);

  if (!chartData.length) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#78716c", fontSize: 14 }}>
        No data available for edge performance analysis
      </div>
    );
  }

  const subtitle = groupBy === "month" ? "by Month" : groupBy === "biweek" ? "by Bi-Week" : "by Week";

  const chart = (height: number, fontSize: number) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis
          dataKey="label"
          stroke="rgba(0,0,0,0.12)"
          tick={{ fill: "#999999", fontSize }}
          axisLine={{ stroke: "#d4d2cc" }}
          tickLine={false}
        />
        <YAxis
          stroke="rgba(0,0,0,0.12)"
          tick={{ fill: "#999999", fontSize }}
          domain={[40, 100]}
          ticks={[40, 50, 60, 70, 80, 90, 100]}
          axisLine={false}
          tickLine={false}
          width={32}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(0,0,0,0.08)", strokeWidth: 1 }} />
        <ReferenceLine
          y={50}
          stroke="#b87070"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          label={{ value: "50%", position: "insideTopRight", fill: "#b87070", fontSize: 10 }}
        />
        {edgeCategories.filter((cat) => visibleCategories.includes(cat.name)).map((cat) => (
          <Line
            key={cat.name}
            type="monotone"
            dataKey={cat.name}
            stroke={cat.color}
            strokeWidth={cat.width}
            dot={{ r: cat.width, fill: cat.color, strokeWidth: 0 }}
            activeDot={{ r: cat.width + 2, fill: cat.color, stroke: "rgba(0,0,0,0.1)", strokeWidth: 2 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div style={{ width: "100%" }}>
      {showTitle && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
            Win Rate by Edge Size — {subtitle}
          </div>
          <div style={{ fontSize: 12, color: "#888888", marginTop: 3 }}>
            Higher edge disagreements with Vegas produce stronger outcomes
          </div>
        </div>
      )}

      <div className="hidden md:block">{chart(300, 11)}</div>
      <div className="block md:hidden">{chart(220, 10)}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
        {edgeCategories.map((cat) => {
          const active = visibleCategories.includes(cat.name);
          return (
            <button
              key={cat.name}
              onClick={() => toggleCategory(cat.name)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                border: `1.5px solid ${active ? cat.color : "rgba(0,0,0,0.15)"}`,
                backgroundColor: active ? `${cat.color}18` : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                opacity: active ? 1 : 0.45,
              }}
            >
              <div style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: cat.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : "#aaaaaa", letterSpacing: "0.03em" }}>
                {cat.name}
              </span>
            </button>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px" }}>
          <svg width="20" height="3">
            <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#b87070" strokeWidth="1.5" strokeDasharray="4,3" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#b87070", letterSpacing: "0.03em" }}>50% break-even</span>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#aaaaaa", textAlign: "center", marginTop: 10 }}>
        Click categories to show / hide
      </p>
    </div>
  );
};

export default EdgePerformanceGraph;
