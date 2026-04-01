import Image from 'next/image';

type MLBLogoProps = {
  teamName: string;
  size?: number;
  className?: string;
};

// MLB team ID mapping for logo URLs
// Logo URL format: https://www.mlbstatic.com/team-logos/{teamId}.svg
const TEAM_IDS: Record<string, number> = {
  "Arizona Diamondbacks": 109,
  "Atlanta Braves": 144,
  "Baltimore Orioles": 110,
  "Boston Red Sox": 111,
  "Chicago Cubs": 112,
  "Chicago White Sox": 145,
  "Cincinnati Reds": 113,
  "Cleveland Guardians": 114,
  "Colorado Rockies": 115,
  "Detroit Tigers": 116,
  "Houston Astros": 117,
  "Kansas City Royals": 118,
  "Los Angeles Angels": 108,
  "Los Angeles Dodgers": 119,
  "Miami Marlins": 146,
  "Milwaukee Brewers": 158,
  "Minnesota Twins": 142,
  "New York Mets": 121,
  "New York Yankees": 147,
  "Oakland Athletics": 133,
  "Athletics": 133,
  "Philadelphia Phillies": 143,
  "Pittsburgh Pirates": 134,
  "San Diego Padres": 135,
  "San Francisco Giants": 137,
  "Seattle Mariners": 136,
  "St. Louis Cardinals": 138,
  "Tampa Bay Rays": 139,
  "Texas Rangers": 140,
  "Toronto Blue Jays": 141,
  "Washington Nationals": 120,
};

export default function MLBLogo({ teamName, size = 40, className = '' }: MLBLogoProps) {
  const teamId = TEAM_IDS[teamName];

  if (!teamId) {
    // Fallback: Show team initials
    const initials = teamName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);

    return (
      <div
        className={className}
        style={{
          width: size, height: size, fontSize: size * 0.35,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#e7e5e4', color: '#57534e', fontWeight: 700,
          borderRadius: '50%',
        }}
        title={teamName}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={`https://www.mlbstatic.com/team-logos/${teamId}.svg`}
      alt={`${teamName} logo`}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
      unoptimized
    />
  );
}
