"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mail, LogOut, LogIn, ArrowLeft, ChevronDown } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/app/firebase-config";

type SportId = "basketball" | "football" | "baseball";

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
    accent: "#3b82f6", accentMuted: "rgba(59,130,246,0.15)",
    leagues: [
      {
        label: "NCAA", id: "ncaa",
        pages: [
          { name: "Today's Picks",  href: "/ncaa-todays-picks" },
          { name: "Rankings",       href: "/ncaa-rankings" },
          { name: "Bracket Pulse",  href: "/ncaa-bracket-pulse" },
          { name: "Over/Under",     href: "/ncaa-total-picks" },
          { name: "Model Accuracy", href: "/ncaa-model-picks-history" },
          { name: "BBMI vs Vegas",  href: "/ncaa-model-vs-vegas" },
        ],
      },
      {
        label: "WIAA", id: "wiaa",
        pages: [
          { name: "Today's Picks",   href: "/wiaa-todays-picks" },
          { name: "Rankings",        href: "/wiaa-rankings" },
          { name: "Bracket Pulse",   href: "/wiaa-bracket-pulse" },
          { name: "Over/Under",      href: "/wiaa-total-picks" },
          { name: "Winner Accuracy", href: "/wiaa-model-accuracy" },
          { name: "Line Accuracy",   href: "/wiaa-line-accuracy" },
          { name: "Teams",           href: "/wiaa-teams" },
        ],
      },
    ],
  },
  {
    id: "football", label: "Football", icon: "🏈",
    accent: "#e8b830", accentMuted: "rgba(232,184,48,0.15)",
    pages: [
      { name: "Weekly Picks",   href: "/ncaaf-picks" },
      { name: "Rankings",       href: "/ncaaf-rankings" },
      { name: "CFP Bracket",    href: "/ncaaf-bracket-pulse" },
      { name: "Over/Under",     href: "/ncaaf-total-picks" },
      { name: "Model Accuracy", href: "/ncaaf-model-accuracy" },
      { name: "BBMI vs Vegas", href: "/ncaaf-model-vs-vegas" },
    ],
  },
  {
    id: "baseball", label: "Baseball", icon: "⚾",
    accent: "#22c55e", accentMuted: "rgba(34,197,94,0.15)",
    placeholder: true, pages: [],
  },
];

function getSportFromPath(p: string): SportId {
  if (p.startsWith("/ncaaf"))  return "football";
  if (p.startsWith("/wiaa"))   return "basketball";
  if (p.startsWith("/ncaa"))   return "basketball";
  return "basketball";
}
function getLeagueFromPath(p: string): string {
  if (p.startsWith("/wiaa")) return "wiaa";
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
    try { await signOut(auth); } catch (e) { console.error(e); }
    setUserMenuOpen(false);
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

  const NAV_BG     = "#0d1f3c";
  const NAV_BORDER = "rgba(255,255,255,0.08)";
  const TEXT_DIM   = "rgba(255,255,255,0.4)";
  const TEXT_MID   = "rgba(255,255,255,0.7)";
  const TEXT_ON    = "#ffffff";

  const ADMIN_EMAIL = "andrewbrantner@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const rowStyle = {
    maxWidth: 1600, margin: "0 auto",
    borderBottom: `1px solid ${NAV_BORDER}`,
    display: "flex", alignItems: "stretch",
    overflowX: "auto" as const, scrollbarWidth: "none" as const,
  };

  return (
    <nav style={{ backgroundColor: NAV_BG, position: "sticky", top: 0, zIndex: 50 }}>

      {/* ── ROW 1: logo + sport icons + auth ── */}
      <div style={{ ...rowStyle, height: 50, alignItems: "center", padding: "0 0.75rem", gap: "0.5rem", overflow: "visible" }}>

        {/* Logo wordmark */}
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0, marginRight: 6 }}>
          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>B</span>
          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: accent, letterSpacing: "-0.02em" }}>BMI</span>
          <span style={{ fontSize: "0.6rem", fontWeight: 500, color: "rgba(255,255,255,0.35)", marginLeft: 3, letterSpacing: "0.07em", fontStyle: "italic" }}>Sports</span>
        </Link>

        {/* Sport icon pills */}
        <div style={{ display: "flex", gap: "0.2rem", flex: 1 }}>
          {SPORTS.map(s => {
            const isOn = s.id === activeSport;
            return (
              <button
                key={s.id}
                onClick={() => {
                  if (s.placeholder) return;
                  setActiveSport(s.id);
                  if (s.leagues) setActiveLeague(s.leagues[0].id);
                  const pages = s.leagues ? s.leagues[0].pages : (s.pages ?? []);
                  // Stay on same-named tab if it exists in the new sport, else fall back to first
                  const currentTabName = subPages.find(p => p.href === pathname)?.name;
                  const matched = currentTabName ? pages.find(p => p.name === currentTabName) : null;
                  router.push((matched ?? pages[0])?.href ?? "/");
                }}
                title={s.label}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  padding: "5px 14px", borderRadius: 20,
                  border: isOn ? `1px solid ${s.accent}` : `1px solid ${NAV_BORDER}`,
                  background: isOn ? s.accentMuted : "transparent",
                  color: isOn ? s.accent : (s.placeholder ? TEXT_DIM : TEXT_MID),
                  fontSize: "0.85rem", fontWeight: isOn ? 700 : 500,
                  cursor: s.placeholder ? "default" : "pointer",
                  opacity: s.placeholder ? 0.5 : 1,
                  transition: "all 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isOn && !s.placeholder) {
                    e.currentTarget.style.borderColor = `${s.accent}66`;
                    e.currentTarget.style.color = s.accent;
                  }
                }}
                onMouseLeave={e => {
                  if (!isOn && !s.placeholder) {
                    e.currentTarget.style.borderColor = NAV_BORDER;
                    e.currentTarget.style.color = TEXT_MID;
                  }
                }}
              >
                {/* Icon + label always shown */}
                <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{s.icon}</span>
                <span style={{ whiteSpace: "nowrap", fontSize: "0.85rem", fontWeight: "inherit" }}>
                  {s.label}
                  {s.placeholder && <span style={{ fontSize: "0.6rem", marginLeft: 3, opacity: 0.6 }}>soon</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Auth + mail */}
        <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexShrink: 0 }}>
          <Link href="/feedback" aria-label="Contact"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, border: `1px solid ${NAV_BORDER}`,
              borderRadius: 6, color: TEXT_MID, flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = NAV_BORDER}
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
                    background: "#0d1f3c", border: `1px solid ${NAV_BORDER}`,
                    borderRadius: 8, padding: "0.5rem", zIndex: 999,
                    minWidth: 170, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}>
                    <div style={{ padding: "0.3rem 0.5rem 0.5rem", borderBottom: `1px solid ${NAV_BORDER}`, marginBottom: "0.3rem" }}>
                      <div style={{ fontSize: "0.65rem", color: TEXT_DIM }}>Signed in as</div>
                      <div style={{ fontSize: "0.75rem", color: TEXT_MID, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                    </div>
                    <Link href="/dashboard" onClick={() => setUserMenuOpen(false)}
                      style={{ display: "block", padding: "0.4rem 0.5rem", fontSize: "0.8rem", color: TEXT_MID, textDecoration: "none", borderRadius: 5 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"}
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
            <Link href="/auth"
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "4px 10px", border: `1px solid ${accent}`,
                borderRadius: 6, background: accentMuted,
                color: accent, fontSize: "0.78rem", fontWeight: 700,
                textDecoration: "none", letterSpacing: "0.01em", flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
            >
              <LogIn size={13} />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── ROW 2: NCAA / WIAA league pills (basketball only) ── */}
      {sport.leagues && (
        <div style={{ ...rowStyle, height: 36, alignItems: "center", padding: "0 0.75rem", gap: "0.25rem" }}>
          {sport.leagues.map(league => {
            const isOn = league.id === activeLeague;
            return (
              <button
                key={league.id}
                onClick={() => {
                  setActiveLeague(league.id);
                  // Stay on same-named tab if it exists in the new league, else fall back to first
                  const currentTabName = subPages.find(p => p.href === pathname)?.name;
                  const matched = currentTabName ? league.pages.find(p => p.name === currentTabName) : null;
                  router.push((matched ?? league.pages[0])?.href ?? "/");
                }}
                style={{
                  padding: "3px 16px", borderRadius: 20,
                  border: isOn ? `1px solid ${accent}` : `1px solid ${NAV_BORDER}`,
                  background: isOn ? accentMuted : "transparent",
                  color: isOn ? accent : TEXT_MID,
                  fontSize: "0.85rem", fontWeight: isOn ? 700 : 500,
                  cursor: "pointer", letterSpacing: "0.03em",
                  transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isOn) {
                    e.currentTarget.style.borderColor = `${accent}55`;
                    e.currentTarget.style.color = accent;
                  }
                }}
                onMouseLeave={e => {
                  if (!isOn) {
                    e.currentTarget.style.borderColor = NAV_BORDER;
                    e.currentTarget.style.color = TEXT_MID;
                  }
                }}
              >
                {league.label}
              </button>
            );
          })}
          {/* Divider + general links on same row as league pills (desktop) */}
          <div style={{ flex: 1 }} />
          <div className="hidden sm:flex" style={{ gap: 0, borderLeft: `1px solid ${NAV_BORDER}` }}>
            {[{ name: "Home", href: "/" }, { name: "About", href: "/about" }].map(item => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: "flex", alignItems: "center", height: 36,
                    padding: "0 14px", whiteSpace: "nowrap",
                    fontSize: "0.78rem", color: isActive ? TEXT_ON : TEXT_DIM,
                    textDecoration: "none",
                    borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = TEXT_MID; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = TEXT_DIM; }}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ROW 3: page sub-nav ── */}
      <div style={{ ...rowStyle, padding: "0 0.5rem" }}>
        {sport.placeholder ? (
          <div style={{ display: "flex", alignItems: "center", height: 36, color: TEXT_DIM, fontSize: "0.78rem", fontStyle: "italic", padding: "0 0.5rem" }}>
            Coming soon — model in development
          </div>
        ) : (
          <>
            {subPages.map(page => {
              const isActive = pathname === page.href;
              const isOuTab  = page.name === "Over/Under";
              const locked   = isOuTab && !isAdmin;

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
                    display: "flex", alignItems: "center", height: 38,
                    padding: "0 14px", whiteSpace: "nowrap",
                    fontSize: "0.9rem", fontWeight: isActive ? 600 : 400,
                    color: isActive ? TEXT_ON : TEXT_MID,
                    textDecoration: "none",
                    borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
                    transition: "color 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = TEXT_ON; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = TEXT_MID; }}
                >
                  {page.name}
                </Link>
              );
            })}
            {/* Home/About in page row on mobile when no league row */}
            {!sport.leagues && (
              <div className="sm:hidden" style={{ display: "flex", marginLeft: "auto" }}>
                {[{ name: "Home", href: "/" }, { name: "About", href: "/about" }].map(item => (
                  <Link key={item.href} href={item.href}
                    style={{
                      display: "flex", alignItems: "center", height: 36,
                      padding: "0 10px", fontSize: "0.78rem",
                      color: TEXT_DIM, textDecoration: "none",
                    }}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

    </nav>
  );
}
