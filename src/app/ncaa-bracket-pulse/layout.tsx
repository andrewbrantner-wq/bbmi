export const metadata = {
  title: "Playoff Pulse – NCAA Tournament Seeding Forecast",
  description:
    "Live NCAA tournament seeding projections powered by BBMI. Track bubble teams, seed movement, and bracket outlook.",
  keywords: [
    "NCAA bracket",
    "seeding forecast",
    "March Madness predictions",
    "BBMI",
  ],
  openGraph: {
    title: "Playoff Pulse – Seeding Forecast",
    description:
      "Live NCAA tournament seeding projections powered by the BBMI model.",
    url: "https://bbmisports.com/ncaa-bracket-pulse",
    siteName: "BBMI Sports",
    type: "website",
  },
};

export default function BracketPulseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}