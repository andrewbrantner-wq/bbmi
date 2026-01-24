import "./globals.css";
import NavBar from "@/components/NavBar";
import { Roboto } from "next/font/google";
import type React from "react";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.className}>
      <body className="pt-24">   {/* ← This is the fix */}
        <NavBar />
        {children}
      </body>
    </html>
  );
}