"use client";

import Image from "next/image";
import ncaaLogoMapping from "@/data/ncaa-logo-mapping.json";
import wiaaLogoMapping from "@/data/wiaa-logo-mapping.json";

type TeamLogoProps = {
  slug: string;
  size?: number;
  league?: "ncaa" | "wiaa";
};

export default function TeamLogo({ 
  slug, 
  size = 28,
  league = "wiaa"  // Default to WIAA
}: TeamLogoProps) {
  if (!slug) return null;

  // Apply logo mapping based on league
  let mappedSlug = slug;
  
  if (league === "ncaa") {
    // Check if there's a mapping for this NCAA team
    const mapping = ncaaLogoMapping as Record<string, string>;
    mappedSlug = mapping[slug] || slug;
  } else if (league === "wiaa") {
    // Check if there's a mapping for this WIAA team
    const mapping = wiaaLogoMapping as Record<string, string>;
    mappedSlug = mapping[slug] || slug;
  }

  const logoPath = `/logos/${league}/${mappedSlug}.png`;

  return (
    <Image
      src={logoPath}
      alt={`${slug} logo`}
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      onError={(e) => {
        // Hide broken image icons
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
