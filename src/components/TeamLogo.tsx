import Image from "next/image";
import ncaaLogoMapping from "@/data/ncaa-logo-mapping.json";

type TeamLogoProps = {
  slug: string;
  size?: number;
  alt?: string;
};

export default function TeamLogo({ slug, size = 32, alt }: TeamLogoProps) {
  if (!slug) return null;

  // Determine league from slug format
  const league = slug.includes("-") ? "wiaa" : "ncaa";
  
  let mappedSlug = slug;
  
  if (league === "ncaa") {
    // Check if there's a mapping for this NCAA team
    const mapping: any = ncaaLogoMapping;
    const teamData = mapping[slug];
    if (teamData && typeof teamData === 'object' && teamData.filename) {
      mappedSlug = teamData.filename.replace('.png', '');
    }
  }
  // WIAA doesn't need mapping - just use slug directly

  const logoPath = league === "ncaa" 
    ? `/images/ncaa-logos/${mappedSlug}.png`
    : `/images/wiaa-logos/${mappedSlug}.png`;

  return (
    <Image
      src={logoPath}
      alt={alt || `${slug} logo`}
      width={size}
      height={size}
      style={{ 
        width: size, 
        height: size,
        objectFit: 'contain'
      }}
      unoptimized
    />
  );
}
