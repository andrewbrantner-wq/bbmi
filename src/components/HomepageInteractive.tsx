"use client";

import React from "react";
import Link from "next/link";

// ------------------------------------------------------------
// Clickable card with navy bottom border → gold on hover
// Used for Today's Picks on homepage
// ------------------------------------------------------------

export function ClickableCard({
  href,
  title,
  description,
  statValue,
  statLabel,
  ctaLabel,
}: {
  href: string;
  title: string;
  description: React.ReactNode;
  statValue?: string;
  statLabel?: string;
  ctaLabel: string;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: "#ffffff",
          border: "1.5px solid #c8c5c2",
          borderBottom: hovered ? "3px solid #4ade80" : "3px solid #0a1a2f",
          borderRadius: 10,
          padding: "1.5rem",
          boxShadow: hovered ? "0 6px 20px rgba(10,26,47,0.18)" : "0 2px 8px rgba(0,0,0,0.08)",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          transition: "box-shadow 0.18s, transform 0.18s, border-bottom-color 0.18s",
          cursor: "pointer",
          height: "100%",
          boxSizing: "border-box" as const,
        }}
      >
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0a1a2f", marginBottom: 8 }}>
          {title}
        </h3>
        <p style={{ fontSize: "0.82rem", color: "#57534e", lineHeight: 1.65, marginBottom: 14 }}>
          {description}
        </p>
        <span style={{
          display: "inline-block",
          fontSize: "0.78rem", color: "#ffffff", fontWeight: 700,
          backgroundColor: "#0a1a2f", borderRadius: 5,
          padding: "4px 12px", letterSpacing: "0.03em",
        }}>
          {ctaLabel}
        </span>
      </div>
    </Link>
  );
}
