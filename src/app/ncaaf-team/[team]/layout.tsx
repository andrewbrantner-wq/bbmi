export const metadata = {
  title: "NCAAF Team Profile – BBMI Sports",
  description:
    "Detailed NCAA football team stats, schedule, and BBMIF model predictions.",
  keywords: [
    "BBMIF",
    "NCAA football team stats",
    "college football schedule",
    "football analytics",
  ],
  openGraph: {
    title: "NCAAF Team Profile – BBMI Sports",
    description:
      "Team-level stats, schedule, and BBMIF predictions for NCAA football.",
    url: "https://bbmisports.com/ncaaf-team",
    siteName: "BBMI Sports",
    type: "website",
  },
};

export default function NCAAFTeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
