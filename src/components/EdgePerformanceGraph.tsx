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
};

type EdgeCategory = {
  name: string;
  min: number;
  max: number;
  color: string;
  width: number;
};

type WeekDataPoint = {
  week: string;
  [key: string]: string | number | null;
};

type Props = {
  games: Game[];
  weeksToShow?: number | null;
  showTitle?: boolean;
};

/* -------------------------------------------------------
   EDGE CATEGORIES
-------------------------------------------------------- */
const EDGE_CATEGORIES: EdgeCategory[] = [
  { name: "≤2 pts",  min: 0, max: 2,        color: "#475569", width: 1.5 },
  { name: "2–4 pts", min: 2, max: 4,        color: "#64748b", width: 1.5 },
  { name: "4–6 pts", min: 4, max: 6,        color: "#3b82f6", width: 2   },
  { name: "6–8 pts", min: 6, max: 8,        color: "#f97316", width: 2.5 },
  { name: ">8 pts",  min: 8, max: Infinity, color: "#22c55e", width: 3   },
];

/* -------------------------------------------------------
   CUSTOM TOOLTIP
-------------------------------------------------------- */
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string; payload: WeekDataPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const validEntries = payload.filter(
    (e) => e.value !== null && Number(e.payload[`${e.name}_count`]) > 0
  );
  if (!validEntries.length) return null;

  return (
    <div style={{
      backgroundColor: "#0a1a2f",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      minWidth: 180,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
        {label}
      </div>
      {validEntries.map((entry) => {
        const count = entry.payload[`${entry.name}_count`] as number;
        return (
          <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: entry.color }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{entry.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: entry.color }}>{entry.value?.toFixed(1)}%</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>({count}g)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------- */
const EdgePerformanceGraph: React.FC<Props> = ({
  games,
  weeksToShow = null,
  showTitle = true,
}) => {
  const [visibleCategories, setVisibleCategories] = React.useState<string[]>([">8 pts"]);

  const toggleCategory = (name: string) => {
    setVisibleCategories((prev) => {
      if (prev.includes(name)) {
        return prev.length === 1 ? prev : prev.filter((c) => c !== name);
      }
      return [...prev, name];
    });
  };

  const { weeklyData } = useMemo(() => {
    if (!games?.length) return { weeklyData: [] };

    const completed = games.filter(
      (g) =>
        g.actualHomeScore !== null &&
        g.actualAwayScore !== null &&
        g.actualHomeScore !== 0 &&
        Number(g.fakeBet) > 0
    );

    const allDates = completed
      .map((g) => (g.date ? g.date.split("T")[0].split(" ")[0] : null))
      .filter((d): d is string => d !== null)
      .sort();

    if (!allDates.length) return { weeklyData: [] };

    const addDays = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };

    const gamesByWeek: Record<number, Game[]> = {};
    let cur = allDates[0];
    let weekNum = 1;
    while (cur <= allDates[allDates.length - 1]) {
      const end = addDays(cur, 6);
      const wg = completed.filter((g) => {
        if (!g.date) return false;
        const d = g.date.split("T")[0].split(" ")[0];
        return d >= cur && d <= end;
      });
      if (wg.length > 0) gamesByWeek[weekNum] = wg;
      cur = addDays(cur, 7);
      weekNum++;
    }

    const sorted = Object.keys(gamesByWeek)
      .map(Number)
      .filter((w) => w > 1)
      .sort((a, b) => a - b);

    const toProcess = weeksToShow ? sorted.slice(-weeksToShow) : sorted;

    const weeklyData: WeekDataPoint[] = toProcess.map((week) => {
      const wg = gamesByWeek[week];
      const dp: WeekDataPoint = { week: `Wk ${week}` };
      EDGE_CATEGORIES.forEach((cat) => {
        const cg = wg.filter((g) => {
          const e = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
          return e >= cat.min && e < cat.max;
        });
        dp[cat.name] = cg.length > 0
          ? parseFloat(((cg.filter((g) => Number(g.fakeWin) > 0).length / cg.length) * 100).toFixed(1))
          : null;
        dp[`${cat.name}_count`] = cg.length;
      });
      return dp;
    });

    return { weeklyData };
  }, [games, weeksToShow]);

  if (!weeklyData.length) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#78716c", fontSize: 14 }}>
        No data available for edge performance analysis
      </div>
    );
  }

  const chart = (height: number, fontSize: number) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={weeklyData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="week"
          stroke="rgba(255,255,255,0.25)"
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize }}
          axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          tickLine={false}
        />
        <YAxis
          stroke="rgba(255,255,255,0.25)"
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize }}
          domain={[40, 100]}
          ticks={[40, 50, 60, 70, 80, 90, 100]}
          axisLine={false}
          tickLine={false}
          width={32}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
        <ReferenceLine
          y={50}
          stroke="#dc2626"
          strokeDasharray="4 3"
          strokeWidth={1.5}
          label={{ value: "50%", position: "insideTopRight", fill: "#dc2626", fontSize: 10 }}
        />
        {EDGE_CATEGORIES.filter((cat) => visibleCategories.includes(cat.name)).map((cat) => (
          <Line
            key={cat.name}
            type="monotone"
            dataKey={cat.name}
            stroke={cat.color}
            strokeWidth={cat.width}
            dot={{ r: cat.width, fill: cat.color, strokeWidth: 0 }}
            activeDot={{ r: cat.width + 2, fill: cat.color, stroke: "rgba(255,255,255,0.3)", strokeWidth: 2 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div style={{ width: "100%" }}>
      {/* HEADER */}
      {showTitle && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>
            Win Rate by Edge Size — by Week
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
            Higher edge disagreements with Vegas produce stronger outcomes
          </div>
        </div>
      )}

      {/* CHART */}
      <div className="hidden md:block">{chart(300, 11)}</div>
      <div className="block md:hidden">{chart(220, 10)}</div>

      {/* LEGEND / TOGGLES */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
        {EDGE_CATEGORIES.map((cat) => {
          const active = visibleCategories.includes(cat.name);
          return (
            <button
              key={cat.name}
              onClick={() => toggleCategory(cat.name)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px",
                borderRadius: 999,
                border: `1.5px solid ${active ? cat.color : "rgba(255,255,255,0.12)"}`,
                backgroundColor: active ? `${cat.color}18` : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                opacity: active ? 1 : 0.45,
              }}
            >
              <div style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: cat.color }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : "rgba(255,255,255,0.5)", letterSpacing: "0.03em" }}>
                {cat.name}
              </span>
            </button>
          );
        })}

        {/* Break-even indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px" }}>
          <svg width="20" height="3">
            <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4,3" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", letterSpacing: "0.03em" }}>50% break-even</span>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 10 }}>
        Click categories to show / hide
      </p>
    </div>
  );
};

export default EdgePerformanceGraph;
