"use client";

import Image from "next/image";
import React from "react";

type League = "ncaa" | "ncaa-baseball" | "ncaa-football" | "wiaa";

interface LogoBadgeProps {
  league: League;
  /** pixel size for both width and height (default: 40) */
  size?: number;
  /** additional wrapper classes (Tailwind or plain CSS) */
  className?: string;
  /** alt text; pass empty string `""` if decorative */
  alt?: string;
  /** pass true to mark image as high priority for loading */
  priority?: boolean;
}

/**
 * Drop-in LogoBadge component for Next.js
 *
 * - Expects logo files to live in the public folder (root). Adjust `src` mapping if yours live in /public/logos/...
 * - Uses next/image for optimization and predictable sizing.
 * - Keeps a small wrapper so you can position the badge (absolute, inline, flex, etc.) from the parent.
 */
export default function LogoBadge({
  league,
  size = 60,
  className = "",
  alt,
  priority = false,
}: LogoBadgeProps) {
  // Adjust these paths to match where your files actually live in /public
  const src =
    league === "ncaa" ? "/ncaa.svg" :
    league === "ncaa-baseball" ? "/ncaa-baseball.png" :
    league === "ncaa-football" ? "/ncaa-football.png" :
    "/wiaa.png";
  const defaultAlt =
    league === "ncaa" || league === "ncaa-baseball" || league === "ncaa-football" ? "NCAA logo" : "WIAA logo";

  // If alt is explicitly empty, mark as decorative for assistive tech
  const ariaHidden = alt === "" ? true : undefined;

  return (
    <div
      className={`inline-block ${className}`}
      style={{ width: size, height: size, lineHeight: 0 }}
      aria-hidden={ariaHidden}
    >
      <Image
        src={src}
        alt={alt ?? defaultAlt}
        width={size}
        height={size}
        className="object-contain"
        priority={priority}
        unoptimized
      />
    </div>
  );
}