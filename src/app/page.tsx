export const metadata = {
  title: "BBMI – Data-Driven Sports Analytics",
  description:
    "Data-driven analytics for MLB, NCAA basketball, football, and baseball — plus WIAA high school basketball. Independent game lines, team rankings, and a fully public pick history. Analytics over instinct.",
  keywords: [
    "MLB analytics",
    "MLB run line picks",
    "NCAA basketball analytics",
    "NCAA football model",
    "NCAA baseball analytics",
    "WIAA basketball predictions",
    "BBMI",
    "sports betting analytics",
  ],
  openGraph: {
    title: "BBMI – Data-Driven Sports Analytics",
    description:
      "Independent game lines for MLB, NCAA basketball, football, and baseball. Built by a risk manager, tracked publicly, never edited.",
    url: "https://www.bbmisports.com",
    siteName: "BBMI",
  },
};

import React from "react";
import Link from "next/link";
import HomePageClient from "./HomePageClient";

export default function HomePage() {
  return <HomePageClient />;
}
