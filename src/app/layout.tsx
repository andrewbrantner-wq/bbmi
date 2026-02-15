import "./globals.css";
import NavBar from "@/components/NavBar";
import { Roboto } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type React from "react";
import FooterDisclaimer from "@/components/FooterDisclaimer";
import { AuthProvider } from "./AuthContext";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.className}>
      <body className="pt-24">
        <AuthProvider>
          <NavBar />
          <main>{children}</main>
          <FooterDisclaimer />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}