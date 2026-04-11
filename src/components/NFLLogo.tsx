import Image from "next/image";

type NFLLogoProps = {
  team: string;       // abbreviation like "KC", "BUF", "SF"
  size?: number;
  className?: string;
};

// Map our standard abbreviations to ESPN's abbreviation format
const ESPN_ABBR: Record<string, string> = {
  ARI: "ari", ATL: "atl", BAL: "bal", BUF: "buf",
  CAR: "car", CHI: "chi", CIN: "cin", CLE: "cle",
  DAL: "dal", DEN: "den", DET: "det", GB: "gb",
  HOU: "hou", IND: "ind", JAX: "jax", KC: "kc",
  LV: "lv",  LAC: "lac", LAR: "lar", MIA: "mia",
  MIN: "min", NE: "ne",  NO: "no",  NYG: "nyg",
  NYJ: "nyj", PHI: "phi", PIT: "pit", SF: "sf",
  SEA: "sea", TB: "tb",  TEN: "ten", WAS: "wsh",
};

export default function NFLLogo({ team, size = 24, className = "" }: NFLLogoProps) {
  const abbr = ESPN_ABBR[team];

  if (!abbr) {
    // Fallback: show abbreviation text
    return (
      <div
        className={className}
        style={{
          width: size, height: size, borderRadius: "50%",
          backgroundColor: "#013369", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
        }}
      >
        {team.slice(0, 3)}
      </div>
    );
  }

  return (
    <Image
      src={`https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`}
      alt={team}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", flexShrink: 0 }}
      unoptimized
    />
  );
}
