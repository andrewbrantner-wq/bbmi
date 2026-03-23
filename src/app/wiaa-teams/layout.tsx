export const metadata = {
  title: "WIAA Teams – Wisconsin High School Basketball Profiles",
  description:
    "Explore WIAA basketball teams with BBMI analytics, performance metrics, and division-level insights.",
  keywords: [
    "WIAA teams",
    "Wisconsin basketball teams",
    "high school basketball analytics",
    "BBMI",
  ],
  openGraph: {
    title: "WIAA Teams – BBMI Profiles",
    description:
      "Explore WIAA basketball teams with BBMI analytics and performance metrics.",
    url: "https://bbmisports.com/wiaa-teams",
    siteName: "BBMI Sports",
    type: "website",
  },
};

export default function WIAATeamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}