"use client";

import { useState } from "react";

export default function DisclaimerFooter() {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer style={{
      backgroundColor: "#1a1a1a",
      borderTop: "1px solid #2d2d2d",
      padding: expanded ? "1rem 1.25rem" : "0.55rem 1.25rem",
      transition: "padding 0.2s ease",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Collapsed: single line */}
        {!expanded && (
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: "1rem", flexWrap: "wrap",
          }}>
            <p style={{
              fontSize: "0.68rem", color: "#6b7280",
              margin: 0, lineHeight: 1.4, flex: 1,
            }}>
              <strong style={{ color: "#9ca3af" }}>Disclaimer:</strong>{" "}
              For informational purposes only. Not financial or gambling advice. Must be 21+. Past performance does not guarantee future results.{" "}
              <strong style={{ color: "#9ca3af" }}>Problem gambling?</strong>{" "}
              <a href="https://www.ncpgambling.org" target="_blank" rel="noopener noreferrer" style={{ color: "#4b5563" }}>1-800-522-4700</a>{" · "}
              <button
                onClick={() => setExpanded(true)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#4b5563", fontSize: "0.68rem",
                  textDecoration: "underline", padding: 0,
                }}
              >
                Read more
              </button>
            </p>
            <div style={{ display: "flex", gap: "1rem", flexShrink: 0, alignItems: "center" }}>
              <span style={{ fontSize: "0.62rem", color: "#374151" }}>
                © {new Date().getFullYear()} BBMI Hoops
              </span>
              <a href="/privacy" style={{ fontSize: "0.62rem", color: "#4b5563", textDecoration: "none" }}>Privacy</a>
              <a href="/terms" style={{ fontSize: "0.62rem", color: "#4b5563", textDecoration: "none" }}>Terms</a>
            </div>
          </div>
        )}

        {/* Expanded: full disclaimer */}
        {expanded && (
          <div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", marginBottom: "0.75rem",
            }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Disclaimer
              </span>
              <button
                onClick={() => setExpanded(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#4b5563", fontSize: "0.7rem", textDecoration: "underline", padding: 0,
                }}
              >
                Collapse ▲
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
              {[
                {
                  title: "For Informational Purposes Only",
                  text: "BBMI Hoops provides sports analytics and model predictions for informational and entertainment purposes only. Nothing on this site constitutes financial, investment, or gambling advice.",
                },
                {
                  title: "Simulated Performance",
                  text: "All win/loss records, ROI figures, and dollar amounts shown use simulated flat $100 wagers. These are hypothetical results and do not represent actual money wagered or won.",
                },
                {
                  title: "Past Performance",
                  text: "Historical model accuracy does not guarantee future results. Sports outcomes are inherently unpredictable. You should never wager more than you can afford to lose.",
                },
                {
                  title: "Know Your Local Laws",
                  text: "Sports betting laws vary by jurisdiction. It is your responsibility to ensure that any betting activity complies with the laws in your location. BBMI Hoops assumes no liability for use of this information.",
                },
                {
                  title: "Responsible Gambling",
                  text: "Must be 21+ to participate in sports betting where legal. If you or someone you know has a gambling problem, call the National Problem Gambling Helpline: 1-800-522-4700 or visit ncpgambling.org.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {item.title}
                  </div>
                  <p style={{ fontSize: "0.67rem", color: "#4b5563", margin: 0, lineHeight: 1.55 }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>

            <div style={{
              borderTop: "1px solid #2d2d2d", paddingTop: "0.6rem",
              display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: "0.5rem",
            }}>
              <span style={{ fontSize: "0.62rem", color: "#374151" }}>
                © {new Date().getFullYear()} BBMI Hoops · All rights reserved
              </span>
              <div style={{ display: "flex", gap: "1.25rem" }}>
                <a href="/privacy" style={{ fontSize: "0.62rem", color: "#4b5563", textDecoration: "none" }}>Privacy Policy</a>
                <a href="/terms" style={{ fontSize: "0.62rem", color: "#4b5563", textDecoration: "none" }}>Terms of Service</a>
                <a href="/feedback" style={{ fontSize: "0.62rem", color: "#4b5563", textDecoration: "none" }}>Contact</a>
              </div>
            </div>
          </div>
        )}

      </div>
    </footer>
  );
}
