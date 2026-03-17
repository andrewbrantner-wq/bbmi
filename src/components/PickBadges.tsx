"use client";

import React from "react";

/**
 * PickBadges — render inline warning badges next to individual picks.
 *
 * Usage (in a picks table row):
 *   <PickBadges cautionWeek={pick.cautionWeek} largeSpread={pick.largeSpread} />
 *
 * Shows small colored badges when a pick falls outside the recommended
 * betting parameters. No output when the pick is clean.
 */

type Props = {
  cautionWeek?: boolean;
  largeSpread?: boolean;
  recommendedBet?: boolean;
  style?: React.CSSProperties;
};

export default function PickBadges({
  cautionWeek,
  largeSpread,
  recommendedBet,
  style,
}: Props) {
  if (!cautionWeek && !largeSpread) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        gap: 4,
        alignItems: "center",
        ...style,
      }}
    >
      {largeSpread && (
        <span
          title="Large spread (>14 pts) — model historically performs at ~50% ATS on blowout games"
          style={{
            fontSize: 10,
            fontWeight: 700,
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            borderRadius: 4,
            padding: "1px 5px",
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
            cursor: "help",
          }}
        >
          BLOWOUT
        </span>
      )}
      {cautionWeek && (
        <span
          title="Weeks 4–7 — limited game data makes model predictions less reliable"
          style={{
            fontSize: 10,
            fontWeight: 700,
            backgroundColor: "#fffbeb",
            color: "#d97706",
            border: "1px solid #fde68a",
            borderRadius: 4,
            padding: "1px 5px",
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
            cursor: "help",
          }}
        >
          EARLY SZN
        </span>
      )}
    </span>
  );
}
