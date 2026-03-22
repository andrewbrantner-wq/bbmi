export const metadata = {
  title: "NCAAF Picks – BBMI Football Predictions",
  description:
    "Weekly college football picks powered by the BBMI model. BBMI lines, Vegas spreads, edge scores, and win probabilities for every FBS game.",
  keywords: [
    "BBMI picks",
    "college football predictions",
    "NCAA football spread",
    "football betting model",
    "ATS picks",
  ],
  openGraph: {
    title: "NCAAF Picks – BBMI Football Predictions",
    description:
      "Weekly college football picks with BBMI lines, Vegas spreads, and edge analysis.",
    url: "https://bbmisports.com/ncaaf-picks",
    siteName: "BBMI Sports",
    type: "website",
  },
};

export default function NCAAFPicksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
