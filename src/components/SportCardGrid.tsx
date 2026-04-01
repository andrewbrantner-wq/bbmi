"use client";

import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import { useAuth } from "@/app/AuthContext";

const ADMIN_EMAIL = "andrewbrantner@gmail.com";
const PUBLIC_LABELS = ["Team Rankings", "Rankings", "Playoff Pulse"];
const BASEBALL_PUBLIC_LABELS = ["Team Rankings", "Rankings"];

type SportPage = { label: string; href: string; primary?: boolean; gated?: boolean };
type SportConfig = {
  name: string;
  league: "ncaa" | "ncaa-football" | "ncaa-baseball" | "wiaa" | "mlb";
  subtitle: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  note?: string;
  gated?: boolean;
  pages: SportPage[];
  primaryHref?: string;
};

export default function SportCardGrid({ sports }: { sports: SportConfig[] }) {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <section style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "1.5rem",
      marginBottom: "2rem",
    }}>
      {sports.map((sport) => {
        const locked = sport.gated && !isAdmin;

        return (
          <div key={sport.name + sport.subtitle} className="sport-card" style={{
            background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
            borderRadius: 12, padding: "1.75rem 1.5rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            borderTop: `3px solid ${sport.accent}`,
            position: "relative",
          }}>
            {/* Sport header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <LogoBadge league={sport.league} size={48} />
              <div>
                <h2 style={{
                  fontSize: "1.2rem", fontWeight: 700, color: "#ffffff", margin: 0,
                }}>
                  {sport.name}
                </h2>
                <div style={{
                  fontSize: "0.7rem", fontWeight: 600, color: sport.accent,
                  letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 2,
                }}>
                  {sport.subtitle}
                </div>
              </div>
            </div>

            {/* Calibration note */}
            {sport.note && (
              <div style={{
                backgroundColor: "rgba(250,204,21,0.1)",
                border: "1px solid rgba(250,204,21,0.25)",
                borderRadius: 6, padding: "0.4rem 0.65rem",
                fontSize: "0.72rem", color: "#facc15", fontWeight: 600,
                marginBottom: 10,
              }}>
                {sport.note}
              </div>
            )}

            {/* Page links */}
            {locked ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                  {sport.pages.filter((p) => (sport.league === "ncaa-baseball" ? BASEBALL_PUBLIC_LABELS : PUBLIC_LABELS).includes(p.label)).map((page) => (
                    <Link key={page.href} href={page.href} className="sport-link">
                      {page.label}
                    </Link>
                  ))}
                </div>
                <div style={{
                  fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: 10,
                  textAlign: "center",
                }}>
                  More pages coming soon — model being calibrated for next season.
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                  {sport.pages.map((page) => (
                    page.gated && !isAdmin ? (
                      <span key={page.href} className="sport-link" style={{ opacity: 0.4, cursor: "default" }}>
                        {page.label}
                      </span>
                    ) : (
                      <Link key={page.href} href={page.href} className="sport-link">
                        {page.label}
                      </Link>
                    )
                  ))}
                </div>

                {/* Primary CTA */}
                <Link
                  href={sport.primaryHref ?? sport.pages[0].href}
                  className="primary-cta"
                  style={{
                    backgroundColor: sport.accent, color: "#ffffff",
                    boxShadow: `0 3px 10px ${sport.accentBorder}`,
                  }}
                >
                  View Game Lines &rarr;
                </Link>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
