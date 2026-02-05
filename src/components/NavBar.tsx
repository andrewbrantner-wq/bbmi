"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function NavBar() {
  const pathname = usePathname();
  const [ncaaOpen, setNcaaOpen] = useState(false);
  const [wiaaOpen, setWiaaOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const base =
    "hover:text-blue-600 transition-colors duration-150 cursor-pointer";
  const active = "text-blue-600 font-semibold";

  return (
    <nav className="w-full bg-white shadow-sm sticky top-0 z-50 border-b border-stone-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Home */}
            <Link
              href="/"
              className={`${base} text-base py-2 ${pathname === "/" ? active : ""}`}
            >
              Home
            </Link>

            {/* NCAA Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setNcaaOpen(true)}
              onMouseLeave={() => setNcaaOpen(false)}
            >
              <button
                className={`${base} text-base py-2 flex items-center gap-1 ${
                  pathname.startsWith("/ncaa") ? active : ""
                }`}
              >
                NCAA
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {ncaaOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-2 border border-stone-200">
                  <Link 
                    href="/ncaa-rankings" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    NCAA Team Rankings
                  </Link>
                  <Link 
                    href="/ncaa-todays-picks" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    NCAA Today's Picks
                  </Link>
                  <Link 
                    href="/ncaa-model-picks-history" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    NCAA Picks Model Accuracy
                  </Link>
                  <Link 
                    href="/ncaa-bracket-pulse" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    NCAA Bracket Pulse
                  </Link>
                </div>
              )}
            </div>

            {/* WIAA Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setWiaaOpen(true)}
              onMouseLeave={() => setWiaaOpen(false)}
            >
              <button
                className={`${base} text-base py-2 flex items-center gap-1 ${
                  pathname.startsWith("/wiaa") ? active : ""
                }`}
              >
                WIAA
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {wiaaOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-2 border border-stone-200">
                  <Link 
                    href="/wiaa-rankings" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    WIAA Rankings
                  </Link>
                  <Link 
                    href="/wiaa-todays-picks" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    WIAA Today's Games
                  </Link>
                  <Link 
                    href="/wiaa-teams" 
                    className="block px-4 py-3 hover:bg-stone-50 text-sm font-medium transition-colors"
                  >
                    WIAA Boys Varsity Teams
                  </Link>
                </div>
              )}
            </div>

            {/* About */}
            <Link
              href="/about"
              className={`${base} text-base py-2 ${pathname === "/about" ? active : ""}`}
            >
              About
            </Link>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-between h-14">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>

          <Link href="/" className="text-lg font-bold">
            Home
          </Link>
          
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 py-4">
            <Link
              href="/"
              className={`block px-4 py-3 text-base hover:bg-stone-50 rounded-lg ${
                pathname === "/" ? "bg-blue-50 text-blue-600 font-semibold" : ""
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>

            <Link
              href="/ncaa-rankings"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              NCAA | Team Rankings
            </Link>
            <Link
              href="/ncaa-todays-picks"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              NCAA | Today's Picks
            </Link>
            <Link
              href="/ncaa-model-picks-history"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              NCAA | Picks Model Accuracy
            </Link>
            <Link
              href="/ncaa-bracket-pulse"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              NCAA | Bracket Pulse
            </Link>

            <Link
              href="/wiaa-rankings"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              WIAA | Rankings
            </Link>
            <Link
              href="/wiaa-todays-picks"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              WIAA | Today's Games
            </Link>
            <Link
              href="/wiaa-teams"
              className="block px-4 py-3 text-base hover:bg-stone-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              WIAA | Boys Varsity Teams
            </Link>

            <Link
              href="/about"
              className={`block px-4 py-3 text-base hover:bg-stone-50 rounded-lg ${
                pathname === "/about" ? "bg-blue-50 text-blue-600 font-semibold" : ""
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
