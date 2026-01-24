"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import Image from "next/image";

<Link href="/" className="flex items-center gap-2">
  <Image
    src="/logo-bbmi-navy.svg" // or .png if you prefer
    alt="BBMI Logo"
    width={120}
    height={32}
    priority
  />
</Link>

export default function NavBar() {
  const pathname = usePathname();
  const [ncaaOpen, setNcaaOpen] = useState(false);
  const [wiaaOpen, setWiaaOpen] = useState(false);

  const base =
    "hover:text-blue-600 transition-colors duration-150 cursor-pointer";
  const active = "text-blue-600 font-semibold";

  return (
    <nav className="w-full bg-white border-b border-stone-200 sticky top-0 z-50">
      <div
        className="max-w-[1600px] mx-auto px-6 py-3 flex items-center text-sm font-medium relative"
        style={{ columnGap: "2.5rem" }} // extra space between buttons
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
              className="absolute left-0 mt-2 border border-stone-200 rounded-md shadow-lg py-2 z-50"
              style={{ width: "260px", backgroundColor: "#ffffff" }} // wider, solid white
            >
              <Link
                href="/ncaa-rankings"
                className="block px-4 py-2 hover:bg-stone-100"
              >
                NCAA Team Rankings
              </Link>
              <Link
                href="/ncaa-todays-picks"
                className="block px-4 py-2 hover:bg-stone-100"
              >
                NCAA Today's Picks
              </Link>
              <Link
                href="/ncaa-model-picks-history"
                className="block px-4 py-2 hover:bg-stone-100"
              >
                NCAA Picks Model Accuracy
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
              className="absolute left-0 mt-2 border border-stone-200 rounded-md shadow-lg py-2 z-50"
              style={{ width: "260px", backgroundColor: "#ffffff" }} // wider, solid white
            >
              <Link
                href="/wiaa-rankings"
                className="block px-4 py-2 hover:bg-stone-100"
              >
                WIAA Rankings
              </Link>
              <Link
                href="/wiaa-game-lines"
                className="block px-4 py-2 hover:bg-stone-100"
              >
                WIAA Game Lines
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}