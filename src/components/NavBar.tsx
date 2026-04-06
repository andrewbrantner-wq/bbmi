"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mail, LogOut, LogIn, ArrowLeft, ChevronDown } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/app/firebase-config";

type SportId = "basketball" | "football" | "baseball" | "ncaa-baseball" | "wiaa";

interface SubNavItem { name: string; href: string; }
interface LeagueSub  { label: string; id: string; pages: SubNavItem[]; }
interface SportConfig {
  id: SportId;
  label: string;
  icon: string;
  accent: string;
  accentMuted: string;
  placeholder?: boolean;
  leagues?: LeagueSub[];
  pages?: SubNavItem[];
}

const SPORTS: SportConfig[] = [
  {
    id: "basketball", label: "Basketball", icon: "🏀",
    accent: "#4a6fa5", accentMuted: "rgba(74,111,165,0.12)",
    leagues: [
      {
        label: "NCAA", id: "ncaa",
        pages: [
          { name: "Today's Picks",    href: "/ncaa-todays-picks" },
          { name: "Rankings",         href: "/ncaa-rankings" },
          { name: "Playoff Pulse",    href: "/ncaa-bracket-pulse" },
          { name: "Model Accuracy",   href: "/ncaa-model-picks-history" },
          { name: "BBMI vs Vegas",    href: "/ncaa-model-vs-vegas" },
          { name: "Bracket",          href: "/bracket-leaderboard" },
        ],
      },
    ],
  },
  {
    id: "baseball", label: "Baseball", icon: "\u26BE",
    accent: "#2d6a4f", accentMuted: "rgba(45,106,79,0.12)",
    leagues: [
      {
        label: "MLB", id: "mlb",
        pages: [
          { name: "Today's Picks",   href: "/mlb/picks" },
          { name: "Rankings",        href: "/mlb/rankings" },
          { name: "Playoff Pulse",   href: "/mlb/bracket-pulse" },
          { name: "Model Accuracy",  href: "/mlb/accuracy" },
          { name: "BBMI vs Vegas",   href: "/mlb/bbmi-vs-vegas" },
        ],
      },
    ],
  },
  {
    id: "football", label: "Football", icon: "🏈",
    accent: "#b5541a", accentMuted: "rgba(181,84,26,0.12)",
    leagues: [
      {
        label: "NCAA", id: "ncaa-football",
        pages: [
          { name: "Today's Picks",   href: "/ncaaf-picks" },
          { name: "Rankings",       href: "/ncaaf-rankings" },
          { name: "Playoff Pulse",    href: "/ncaaf-bracket-pulse" },
          { name: "Model Accuracy", href: "/ncaaf-model-accuracy" },
          { name: "BBMI vs Vegas", href: "/ncaaf-model-vs-vegas" },
        ],
      },
    ],
  },
  {
    id: "ncaa-baseball", label: "Baseball", icon: "\u26BE",
    accent: "#2a7a72", accentMuted: "rgba(42,122,114,0.12)",
    leagues: [
      {
        label: "NCAA", id: "ncaa-baseball",
        pages: [
          { name: "Today's Picks",   href: "/baseball/picks" },
          { name: "Rankings",        href: "/baseball/rankings" },
          { name: "Model Accuracy",  href: "/baseball/accuracy" },
          { name: "BBMI vs Vegas",   href: "/baseball/vs-vegas" },
        ],
      },
    ],
  },
  {
    id: "wiaa", label: "Basketball", icon: "🏀",
    accent: "#6b4fa5", accentMuted: "rgba(107,79,165,0.12)",
    leagues: [
      {
        label: "WIAA", id: "wiaa",
        pages: [
          { name: "Today's Picks",   href: "/wiaa-todays-picks" },
          { name: "Rankings",        href: "/wiaa-rankings" },
          { name: "Playoff Pulse",   href: "/wiaa-bracket-pulse" },
          { name: "Model Accuracy",  href: "/wiaa-model-accuracy" },
        ],
      },
    ],
  },
];

function getSportFromPath(p: string): SportId {
  if (p.startsWith("/ncaaf"))    return "football";
  if (p.startsWith("/mlb"))      return "baseball";
  if (p.startsWith("/baseball")) return "ncaa-baseball";
  if (p.startsWith("/wiaa"))     return "wiaa";
  if (p.startsWith("/ncaa"))     return "basketball";
  return "basketball";
}
function getLeagueFromPath(p: string): string {
  if (p.startsWith("/wiaa")) return "wiaa";
  if (p.startsWith("/mlb"))  return "mlb";
  if (p.startsWith("/baseball")) return "ncaa-baseball";
  return "ncaa";
}

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  const [activeSport,  setActiveSport]  = useState<SportId>(() => getSportFromPath(pathname));
  const [activeLeague, setActiveLeague] = useState<string>(() => getLeagueFromPath(pathname));
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setActiveSport(getSportFromPath(pathname));
    setActiveLeague(getLeagueFromPath(pathname));
  }, [pathname]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  };

  const sport       = SPORTS.find(s => s.id === activeSport) ?? SPORTS[0];
  const accent      = sport.accent;
  const accentMuted = sport.accentMuted;

  const subPages: SubNavItem[] = (() => {
    if (sport.leagues) {
      return (sport.leagues.find(l => l.id === activeLeague) ?? sport.leagues[0]).pages;
    }
    return sport.pages ?? [];
  })();

  const NAV_BG     = "#f0efe9";
  const NAV_BORDER = "rgba(0,0,0,0.08)";
  const TEXT_DIM   = "#aaaaaa";
  const TEXT_MID   = "#888888";
  const TEXT_ON    = "#1a1a1a";

  const ADMIN_EMAIL = "andrewbrantner@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <nav style={{ backgroundColor: NAV_BG, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 0 #d8d6ce", paddingBottom: 2 }}>

      {/* ── Rows 1+2: logo, buttons, sport pills (flex-wrap) ── */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 px-5" style={{ minHeight: 44 }}>

        {/* Logo — always row 1, left */}
        <div className="flex-shrink-0" style={{ paddingLeft: 4 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.02em" }}>BBMI</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: accent, letterSpacing: "-0.02em" }}>Sports</span>
          </Link>
        </div>

        {/* Pills — row 2 on mobile (order-3 + w-full), inline on desktop (lg:order-2 + lg:w-auto) */}
        <div className="order-3 lg:order-2 w-full lg:w-auto lg:flex-1 flex gap-1 overflow-x-auto py-1.5 lg:py-0 hide-scrollbar" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
          {SPORTS.map(s => {
            const isOn = s.id === activeSport;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSport(s.id);
                  if (s.leagues) setActiveLeague(s.leagues[0].id);
                  const pages = s.leagues ? s.leagues[0].pages : (s.pages ?? []);
                  const currentTabName = subPages.find(p => p.href === pathname)?.name;
                  const matched = currentTabName ? pages.find(p => p.name === currentTabName) : null;
                  router.push((matched ?? pages[0])?.href ?? "/");
                }}
                title={s.label}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 999,
                  border: isOn ? `1px solid ${s.accent}40` : "1px solid transparent",
                  background: isOn ? `${s.accent}18` : "transparent",
                  color: isOn ? s.accent : "#555555",
                  fontSize: 11, fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isOn) {
                    e.currentTarget.style.borderColor = `${s.accent}66`;
                    e.currentTarget.style.color = s.accent;
                  }
                }}
                onMouseLeave={e => {
                  if (!isOn) {
                    e.currentTarget.style.borderColor = NAV_BORDER;
                    e.currentTarget.style.color = TEXT_MID;
                  }
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: s.accent, display: "inline-block", flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", fontSize: 11, fontWeight: 500 }}>
                  {s.label}
                </span>
                {s.leagues && s.leagues.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 400, color: isOn ? s.accent : TEXT_DIM, opacity: 0.7 }}>
                    {(s.leagues.find(l => l.id === activeLeague) ?? s.leagues[0]).label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Buttons — always row 1, right (order-2 on mobile so they stay next to logo) */}
        <div className="order-2 lg:order-3 ml-auto flex-shrink-0 flex gap-1.5 items-center">
        {!user && (
          <Link href="/subscribe" style={{
            fontSize: 11, fontWeight: 500, color: "#ffffff",
            backgroundColor: "#2952cc", padding: "4px 12px",
            borderRadius: 6, textDecoration: "none",
            position: "relative", zIndex: 10, cursor: "pointer",
          }}>
            Subscribe
          </Link>
        )}
        <Link href="/feedback" aria-label="Contact"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 26, border: `0.5px solid rgba(0,0,0,0.18)`,
            borderRadius: 6, color: TEXT_MID, flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.25)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.18)"}
        >
          <Mail size={14} />
        </Link>

        {user ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                padding: "4px 8px", border: `1px solid ${NAV_BORDER}`,
                borderRadius: 6, background: "transparent",
                color: TEXT_MID, fontSize: "0.75rem", cursor: "pointer",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: accent, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "0.6rem", fontWeight: 700,
                color: "#0d1f3c", flexShrink: 0,
              }}>
                {user.email?.[0].toUpperCase() ?? "U"}
              </div>
              <span className="hidden sm:inline" style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email?.split("@")[0]}
              </span>
              <ChevronDown size={11} style={{ opacity: 0.5 }} />
            </button>

            {userMenuOpen && (
              <>
                <div onClick={() => setUserMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)",
                  background: "#ffffff", border: `1px solid ${NAV_BORDER}`,
                  borderRadius: 8, padding: "0.5rem", zIndex: 999,
                  minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ padding: "0.3rem 0.5rem 0.5rem", borderBottom: `1px solid ${NAV_BORDER}`, marginBottom: "0.3rem" }}>
                    <div style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Signed in as</div>
                    <div style={{ fontSize: "0.75rem", color: TEXT_MID, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                  </div>
                  <Link href="/dashboard" onClick={() => setUserMenuOpen(false)}
                    style={{ display: "block", padding: "0.4rem 0.5rem", fontSize: "0.8rem", color: TEXT_MID, textDecoration: "none", borderRadius: 5 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    My Subscription
                  </Link>
                  <button
                    onClick={handleSignOut}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.4rem",
                      width: "100%", padding: "0.4rem 0.5rem",
                      background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)",
                      borderRadius: 5, color: "#fca5a5", fontSize: "0.8rem",
                      cursor: "pointer", marginTop: "0.25rem",
                    }}
                  >
                    <LogOut size={13} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link href={`/auth?returnTo=${encodeURIComponent(pathname)}`}
            style={{
              fontSize: 11, fontWeight: 500, color: "#555555",
              padding: "4px 12px", borderRadius: 6,
              border: "0.5px solid rgba(0,0,0,0.18)",
              textDecoration: "none", flexShrink: 0,
            }}
          >
            Log in
          </Link>
        )}
      </div>
      </div>{/* close flex-wrap rows 1+2 */}

      {/* ── ROW 3: page tabs (untouched) ── */}
      <div style={{ background: "#e4e2d9", borderBottom: "1px solid #d5d3ca" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", padding: "0 20px", height: 36, gap: 2, overflowX: "auto", scrollbarWidth: "none" as const }}>
        {sport.placeholder ? (
          <div style={{ display: "flex", alignItems: "center", height: 36, color: TEXT_DIM, fontSize: "0.78rem", fontStyle: "italic", padding: "0 0.5rem" }}>
            Coming soon — model in development
          </div>
        ) : (
          <>
            {/* League pills removed — sport context now conveyed by Row 1 pills */}
            {subPages.map(page => {
              const isActive = pathname === page.href;
              const isOuTab  = page.name === "Over/Under";
              const isNcaaBaseballBracket = activeSport === "baseball" && activeLeague === "ncaa-baseball" && page.name === "Playoff Pulse";
              // Lock: NCAA baseball Playoff Pulse (admin only) — MLB Playoff Pulse is public
              const locked = isNcaaBaseballBracket && !isAdmin;

              if (locked) {
                return (
                  <span
                    key={page.href}
                    title="Internal — admin only"
                    style={{
                      display: "flex", alignItems: "center", height: 38,
                      padding: "0 14px", whiteSpace: "nowrap",
                      fontSize: "0.9rem", fontWeight: 400,
                      color: TEXT_DIM, borderBottom: "2px solid transparent",
                      cursor: "default", flexShrink: 0, opacity: 0.45,
                    }}
                  >
                    {page.name}
                  </span>
                );
              }

              return (
                <Link key={page.href} href={page.href}
                  style={{
                    display: "flex", alignItems: "center", height: 28,
                    padding: "0 10px", whiteSpace: "nowrap", borderRadius: 6,
                    fontSize: 12, fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#1a1a1a" : "#aaaaaa",
                    backgroundColor: isActive ? "rgba(0,0,0,0.07)" : "transparent",
                    textDecoration: "none",
                    transition: "all 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.color = "#1a1a1a"; }}}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "#aaaaaa"; }}}
                >
                  {page.name}
                </Link>
              );
            })}
            {/* About link at end of tabs */}
            <div style={{ flex: 1 }} />
            <Link href="/about" style={{
              display: "flex", alignItems: "center", height: 28,
              padding: "0 10px", whiteSpace: "nowrap", borderRadius: 6,
              fontSize: 12, fontWeight: pathname === "/about" ? 500 : 400,
              color: pathname === "/about" ? "#1a1a1a" : "#aaaaaa",
              backgroundColor: pathname === "/about" ? "rgba(0,0,0,0.07)" : "transparent",
              textDecoration: "none",
            }}>
              About
            </Link>
          </>
        )}
      </div>
      </div>

    </nav>
  );
}
