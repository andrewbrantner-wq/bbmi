"use client";

import React, { useState, useCallback } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  date: string;
  away: string;
  home: string;
  vegasHomeLine: number;
  bbmiHomeLine: number;
  bbmiWinProb: number;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: number;
  fakeWin: number;
  vegaswinprob: number;
};

type GameWithEdge = Game & {
  edge: number;
  awayRank: number | null;
  homeRank: number | null;
};

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  away: "The visiting team. Click the team name to see their full schedule and model history.",
  home: "The home team. Click the team name to see their full schedule and model history.",
  vegas: "The Vegas point spread for the home team. Negative = home team is favored. Example: -5.5 means the home team must win by 6+ to cover.",
  bbmi: "What BBMI's model predicts the spread should be. Compare this to the Vegas line — the bigger the gap, the more the model disagrees with Vegas.",
  edge: "The gap between BBMI's line and the Vegas line. Larger edge = stronger model conviction. These are today's highest-edge games.",
  pick: "The team BBMI's model favors to cover the spread, based on the direction of the edge.",
};

// ------------------------------------------------------------
// PORTAL COMPONENT
// ------------------------------------------------------------

function ColDescPortal({
  tooltipId,
  anchorRect,
  onClose,
}: {
  tooltipId: string;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const text = TOOLTIPS[tooltipId];
  const el = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (el.current && !el.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!text || typeof document === "undefined") return null;

  const left = Math.min(
    anchorRect.left + anchorRect.width / 2 - 110,
    window.innerWidth - 234
  );
  const top = anchorRect.bottom + 6;

  return ReactDOM.createPortal(
    <div
      ref={el}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 99999,
        width: 220,
        backgroundColor: "#1e3a5f",
        border: "1px solid #3a5a8f",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          padding: "10px 28px 6px 12px",
          fontSize: 12,
          color: "#e2e8f0",
          lineHeight: 1.5,
          textAlign: "left",
          whiteSpace: "normal",
        }}
      >
        {text}
      </div>
      <button
        onMouseDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#94a3b8",
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// TABLE HEADER — same pattern as picks history page
// ------------------------------------------------------------

function DescHeader({
  label,
  tooltipId,
  descPortal,
  openDesc,
  closeDesc,
  align = "center",
}: {
  label: string;
  tooltipId: string;
  descPortal: { id: string; rect: DOMRect } | null;
  openDesc: (id: string, rect: DOMRect) => void;
  closeDesc: () => void;
  align?: "left" | "center";
}) {
  const thRef = React.useRef<HTMLTableCellElement>(null);
  const uid = tooltipId + "_bp";
  const descShowing = descPortal?.id === uid;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (descShowing) {
      closeDesc();
    } else {
      const rect = thRef.current?.getBoundingClientRect();
      if (rect) openDesc(uid, rect);
    }
  };

  return (
    <th
      ref={thRef}
      style={{ textAlign: align }}
    >
      <span
        onClick={handleLabelClick}
        style={{
          cursor: "help",
          textDecoration: "underline dotted",
          textUnderlineOffset: 3,
          textDecorationColor: "rgba(255,255,255,0.45)",
        }}
      >
        {label}
      </span>
    </th>
  );
}

// ------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------

type Props = {
  topPlays: GameWithEdge[];
  historicalWinPct: string;
};

export default function BestPlaysCard({ topPlays, historicalWinPct }: Props) {
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);

  const openDesc = useCallback((id: string, rect: DOMRect) => {
    setDescPortal({ id, rect });
  }, []);

  const closeDesc = useCallback(() => {
    setDescPortal(null);
  }, []);

  if (topPlays.length === 0) return null;

  const getBBMIPick = (game: GameWithEdge): string => {
    if (game.bbmiHomeLine < game.vegasHomeLine) return game.home;
    if (game.bbmiHomeLine > game.vegasHomeLine) return game.away;
    return "";
  };

  return (
    <>
      {descPortal && (
        <ColDescPortal
          tooltipId={descPortal.id.split("_")[0]}
          anchorRect={descPortal.rect}
          onClose={closeDesc}
        />
      )}

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
          <div className="rankings-scroll">
            <table>
              <thead>
                <tr>
                  <DescHeader label="Away" tooltipId="away" descPortal={descPortal} openDesc={openDesc} closeDesc={closeDesc} align="left" />
                  <DescHeader label="Home" tooltipId="home" descPortal={descPortal} openDesc={openDesc} closeDesc={closeDesc} align="left" />
                  <DescHeader label="Vegas" tooltipId="vegas" descPortal={descPortal} openDesc={openDesc} closeDesc={closeDesc} />
                  <DescHeader label="BBMI" tooltipId="bbmi" descPortal={descPortal} openDesc={openDesc} closeDesc={closeDesc} />
                  <DescHeader label="Edge" tooltipId="edge" descPortal={descPortal} openDesc={openDesc} closeDesc={closeDesc} />
                  <DescHeader label="BBMI Pick" tooltipId="pick" descPortal={descPortal} openDesc={openDesc} closeDesc={closeDesc} align="left" />
                </tr>
              </thead>

              <tbody>
                {topPlays.map((g, i) => {
                  const pickTeam = getBBMIPick(g);
                  const pickRank = pickTeam === g.home ? g.homeRank : pickTeam === g.away ? g.awayRank : null;

                  return (
                    <tr key={i}>
                      <td style={{ textAlign: "left" }}>
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(g.away)}`}
                          className="hover:underline cursor-pointer flex items-center gap-2"
                        >
                          <NCAALogo teamName={g.away} size={24} />
                          <span>
                            {g.away}
                            {g.awayRank !== null && (
                              <span
                                className="ml-1"
                                style={{
                                  fontSize: "0.65rem",
                                  fontStyle: "italic",
                                  fontWeight: g.awayRank <= 25 ? "bold" : "normal",
                                  color: g.awayRank <= 25 ? "#dc2626" : "#78716c",
                                }}
                              >
                                (#{g.awayRank})
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(g.home)}`}
                          className="hover:underline cursor-pointer flex items-center gap-2"
                        >
                          <NCAALogo teamName={g.home} size={24} />
                          <span>
                            {g.home}
                            {g.homeRank !== null && (
                              <span
                                className="ml-1"
                                style={{
                                  fontSize: "0.65rem",
                                  fontStyle: "italic",
                                  fontWeight: g.homeRank <= 25 ? "bold" : "normal",
                                  color: g.homeRank <= 25 ? "#dc2626" : "#78716c",
                                }}
                              >
                                (#{g.homeRank})
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td>{g.vegasHomeLine}</td>
                      <td>{g.bbmiHomeLine}</td>
                      <td style={{ fontWeight: 600 }}>{g.edge.toFixed(1)}</td>
                      <td style={{ fontWeight: 600, textAlign: "left" }}>
                        {pickTeam && (
                          <Link
                            href={`/ncaa-team/${encodeURIComponent(pickTeam)}`}
                            className="hover:underline cursor-pointer flex items-center gap-2"
                          >
                            <NCAALogo teamName={pickTeam} size={20} />
                            <span>
                              {pickTeam}
                              {pickRank !== null && (
                                <span
                                  className="ml-1"
                                  style={{
                                    fontSize: "0.65rem",
                                    fontStyle: "italic",
                                    fontWeight: pickRank <= 25 ? "bold" : "normal",
                                    color: pickRank <= 25 ? "#dc2626" : "#78716c",
                                  }}
                                >
                                  (#{pickRank})
                                </span>
                              )}
                            </span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-stone-600 mt-3 text-center italic">
          Note: The probability of beating Vegas odds increases to {historicalWinPct}% when the BBMI line varies from the Vegas line by more than 6.5 points. Past results are not indicative of future performance.
        </p>
      </div>
    </>
  );
}
