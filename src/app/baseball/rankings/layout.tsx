export const metadata = {
  title: "Baseball Rankings – NCAA D1 Team Ratings by BBMI",
  description:
    "NCAA D1 baseball team rankings with RPI, offensive/defensive ratings, ERA, wOBA, and strength of schedule. Updated daily.",
  keywords: ["baseball rankings", "NCAA baseball", "college baseball rankings", "BBMI baseball"],
  openGraph: {
    title: "Baseball Rankings – BBMI Sports",
    description: "308 D1 baseball teams ranked by RPI with BBMI offensive and defensive metrics.",
    url: "https://bbmisports.com/baseball/rankings",
    siteName: "BBMI Sports",
  },
};

export default function BaseballRankingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
