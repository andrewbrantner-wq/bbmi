// TeamLogo.tsx
type TeamLogoProps = {
  slug: string;
  size?: number;
};

export default function TeamLogo({ slug, size = 25 }: TeamLogoProps) {
  return (
    <img
      src={`/logos/wiaa/${slug}.png`}
      alt={`${slug} logo`}
      width={size}
      height={size}
      className="object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}