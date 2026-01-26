export const metadata = {
  title: "Model Results – BBMI Performance Tracking",
  description:
    "Track BBMI model accuracy, prediction performance, and historical results across the NCAA season.",
  keywords: ["model results", "prediction accuracy", "BBMI performance"],
  openGraph: {
    title: "Model Results – BBMI Performance",
    description:
      "Track BBMI model accuracy and prediction performance.",
    url: "https://bbmihoops.com/model-results",
    siteName: "BBMI Hoops",
  },
};


export default function NCAAModelPicksHistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}