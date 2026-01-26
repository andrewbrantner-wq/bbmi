export const metadata = {
  title: "Bracket Pulse – NCAA Tournament Seeding Forecast",
  description:
    "Live NCAA tournament seeding projections powered by BBMI. Track bubble teams, seed movement, and bracket outlook.",
  keywords: [
    "NCAA bracket",
    "seeding forecast",
    "March Madness predictions",
    "BBMI",
  ],
  openGraph: {
    title: "Bracket Pulse – Seeding Forecast",
    description:
      "Live NCAA tournament seeding projections powered by the BBMI model.",
    url: "https://bbmihoops.com/ncaa-bracket-pulse",
    siteName: "BBMI Hoops",
    type: "website",
  },
};

export default function BracketPulseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}