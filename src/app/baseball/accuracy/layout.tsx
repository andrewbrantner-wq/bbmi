export const metadata = {
  title: "Baseball Model Accuracy – BBMI Sports",
  description:
    "Full public log of every BBMI college baseball pick vs actual results. ATS record, O/U record, edge performance breakdown, ROI at -110 juice, and game-by-game results with pitcher data.",
  keywords: [
    "baseball model accuracy",
    "BBMI baseball record",
    "college baseball picks history",
    "baseball ATS record",
    "college baseball over under",
    "baseball betting model results",
  ],
  openGraph: {
    title: "Baseball Model Accuracy – BBMI Sports",
    description:
      "Transparent public log of every BBMI baseball pick. ATS and O/U records with 95% confidence intervals.",
    url: "https://bbmisports.com/baseball/accuracy",
    siteName: "BBMI Sports",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
