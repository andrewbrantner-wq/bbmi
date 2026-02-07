import Image from 'next/image';
import logoMapping from '@/data/ncaa-logo-mapping.json';

type NCAALogoProps = {
  teamName: string;
  size?: number;
  className?: string;
};

export default function NCAALogo({ teamName, size = 40, className = '' }: NCAALogoProps) {
  // Get logo info from mapping
  const logoInfo = logoMapping[teamName as keyof typeof logoMapping];
  
  if (!logoInfo) {
    // Fallback: Show team initials
    const initials = teamName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);
    
    return (
      <div
        className={`flex items-center justify-center bg-stone-200 text-stone-700 font-bold rounded-full ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
        title={teamName}
      >
        {initials}
      </div>
    );
  }
  
  return (
    <Image
      src={logoInfo.path}
      alt={`${teamName} logo`}
      width={size}
      height={size}
      className={className}
      title={teamName}
    />
  );
}
