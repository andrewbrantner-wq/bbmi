export const metadata = {
  title: "NCAAF Picks – BBMIF Football Predictions",
  description:
    "Weekly college football picks powered by the BBMIF model. BBMIF lines, Vegas spreads, edge scores, and win probabilities for every FBS game.",
  keywords: [
    "BBMIF picks",
    "college football predictions",
    "NCAA football spread",
    "football betting model",
    "ATS picks",
  ],
  openGraph: {
    title: "NCAAF Picks – BBMIF Football Predictions",
    description:
      "Weekly college football picks with BBMIF lines, Vegas spreads, and edge analysis.",
    url: "https://bbmisports.com/ncaaf-picks",
    siteName: "BBMI Sports",
    type: "website",
  },
};

export default function NCAAFPicksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
