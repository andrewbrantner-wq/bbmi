"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

export default function NavBar() {
  const pathname = usePathname();
  const [ncaaOpen, setNcaaOpen] = useState(false);
  const [wiaaOpen, setWiaaOpen] = useState(false);

  const base =
    "hover:text-blue-600 transition-colors duration-150 cursor-pointer";
  const active = "text-blue-600 font-semibold";

  return (
    <nav className="w-full bg-white sticky top z-50">
      <div
        className="max-w-[1600px] mx-auto px-6 py-3 flex items-center text-sm font-medium relative"
        style={{ columnGap: "2.5rem" }}
      >
        {/* Home */}
        <Link
          href="/"
          className={`${base} ${pathname === "/" ? active : ""}`}
        >
          Home
        </Link>

        {/* NCAA */}
        <div
          className="relative"
          onMouseEnter={() => setNcaaOpen(true)}
          onMouseLeave={() => setNcaaOpen(false)}
        >
          <span
            className={`${base} ${
              pathname.startsWith("/ncaa") ? active : ""
            }`}
          >
            NCAA ▾
          </span>

          {ncaaOpen && (
            <div
              className="absolute left-0 mt-2 rounded-2xl shadow-lg py-2 z-50"
              style={{ width: "260px", backgroundColor: "#ffffff" }}
            >
              <Link href="/ncaa-rankings" className="block px-4 py-2 hover:bg-stone-100 rounded mt-2 mb-2">
                NCAA Team Rankings
              </Link>
              <Link href="/ncaa-todays-picks" className="block px-4 py-2 hover:bg-stone-100  rounded mt-2 mb-2">
                NCAA Today's Picks
              </Link>
              <Link href="/ncaa-model-picks-history" className="block px-4 py-2 hover:bg-stone-100  rounded mt-2 mb-2">
                NCAA Picks Model Accuracy
              </Link>
              <Link href="/ncaa-bracket-pulse" className="block px-4 py-2 hover:bg-stone-100 rounded mt-2 mb-2">
                NCAA Bracket Pulse
              </Link>
            </div>
          )}
        </div>

        {/* WIAA */}
        <div
          className="relative"
          onMouseEnter={() => setWiaaOpen(true)}
          onMouseLeave={() => setWiaaOpen(false)}
        >
          <span
            className={`${base} ${
              pathname.startsWith("/wiaa") ? active : ""
            }`}
          >
            WIAA ▾
          </span>

          {wiaaOpen && (
            <div
              className="absolute left-0 mt-4 rounded-2xl shadow-lg py-2 z-50"
              style={{ width: "260px", backgroundColor: "#ffffff" }}
            >
              <Link href="/wiaa-rankings" className="block px-4 py-2 hover:bg-stone-100 mt-2 mb-2">
                WIAA Rankings
              </Link>
              <Link href="/wiaa-todays-picks" className="block px-4 py-2 hover:bg-stone-100 mt-2">
                WIAA Todays Games
              </Link>
              <Link href="/wiaa-teams" className="block px-4 py-2 hover:bg-stone-100 mt-2 mb-2">
                WIAA Boys Varsity Teams
              </Link>
            </div>
          )}
        </div>

        {/* ⭐ NEW — About Button */}
        <Link
          href="/about"
          className={`${base} ${pathname === "/about" ? active : ""}`}
        >
          About
        </Link>
      </div>
    </nav>
  );
}