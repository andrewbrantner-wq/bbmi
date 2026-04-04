import "./globals.css";
import NavBar from "@/components/NavBar";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type React from "react";
import FooterDisclaimer from "@/components/FooterDisclaimer";
import { AuthProvider } from "./AuthContext";
import AuthDiagnostics from "./AuthDiagnostics";
import PageViewTracker from "./PageViewTracker";


const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="pt-24">
        <AuthProvider>
          <AuthDiagnostics />
          <PageViewTracker />
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