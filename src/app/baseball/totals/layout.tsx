import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baseball Over/Under Totals — BBMI Sports",
  description:
    "BBMI projected game totals vs Vegas over/under lines for NCAA D1 baseball. Under-focused totals product with pitcher-adjusted projections.",
  keywords: [
    "baseball over under",
    "BBMI totals",
    "college baseball totals",
    "NCAA baseball over under",
    "baseball under picks",
  ],
  openGraph: {
    title: "Baseball Over/Under Totals — BBMI Sports",
    description:
      "BBMI projected game totals vs Vegas over/under lines for NCAA D1 baseball.",
    url: "https://bbmisports.com/baseball/totals",
    siteName: "BBMI Sports",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Baseball Over/Under Totals — BBMI Sports",
    description:
      "BBMI projected game totals vs Vegas O/U lines. Under-focused totals product.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
