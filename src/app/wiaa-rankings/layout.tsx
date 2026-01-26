export const metadata = {
  title: "WIAA Rankings – Wisconsin High School Basketball Analytics",
  description:
    "Live WIAA basketball rankings powered by the Brantner Basketball Model Index. Updated daily with performance metrics and division-level insights.",
  keywords: [
    "WIAA rankings",
    "Wisconsin high school basketball",
    "BBMI",
    "WIAA analytics",
    "high school basketball ratings",
  ],
  openGraph: {
    title: "WIAA Rankings",
    description:
      "Advanced WIAA basketball rankings powered by the Brantner Basketball Model Index.",
    url: "https://bbmihoops.com/wiaa-rankings",
    siteName: "BBMI Hoops",
    type: "website",
  },
};

export default function WIAARankingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}