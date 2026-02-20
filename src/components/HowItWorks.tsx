"use client";
// components/HowItWorks.tsx
// Drop this into page.tsx just below the hero section, above the white panel.
// Usage: <HowItWorks winPct="58.8" roi="13.0" gamesTracked="1,664" hasTodaysPick={topPlays.length > 0} />

type HowItWorksProps = {
  winPct: string;
  roi: string;
  gamesTracked: string;
  hasTodaysPick: boolean;
};

export default function HowItWorks({ winPct, roi, gamesTracked, hasTodaysPick }: HowItWorksProps) {
  const steps = [
    {
      number: "1",
      emoji: "📊",
      title: "Browse free picks",
      description: hasTodaysPick
        ? "Today's top-edge game is previewed publicly on the homepage — no account needed."
        : "Top-edge games are previewed publicly on the homepage when available — no account needed.",
      href: "#top-plays",
      cta: hasTodaysPick ? "See today's top pick ↓" : null,
    },
    {
      number: "2",
      emoji: "📈",
      title: "Verify the track record",
      description: "Every pick is logged publicly. No retroactive edits, ever. Check the full history yourself.",
      href: "/ncaa-model-picks-history",
      cta: "View full history →",
    },
    {
      number: "3",
      emoji: "🎯",
      title: "Subscribe for full access",
      description: "Get every daily pick, edge scores, and win probabilities. Start with a 7-day trial for $15, then $49/mo.",
      href: "/ncaa-todays-picks",
      cta: "Start $15 trial →",
      highlight: true,
    },
  ];

  return (
    <section style={{
      margin: "0 auto 2rem",
      maxWidth: 900,
      padding: "0 1rem",
    }}>
      {/* Trust headline */}
      <div style={{
        textAlign: "center",
        marginBottom: "1.25rem",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          backgroundColor: "#0a1a2f",
          color: "#ffffff",
          borderRadius: 999,
          padding: "0.35rem 1rem",
          fontSize: "0.78rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          marginBottom: "0.75rem",
        }}>
          <span style={{ color: "#4ade80" }}>●</span>
          {winPct}% picks beat Vegas · {roi}% ROI · {gamesTracked} games tracked
        </div>
        <h2 style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#1a1a1a",
          margin: 0,
        }}>
          How BBMI works — in 3 steps
        </h2>
      </div>

      {/* Steps */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "0.875rem",
      }}>
        {steps.map((step) => (
          <a
            key={step.number}
            href={step.href}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "1.1rem",
              backgroundColor: step.highlight ? "#0a1a2f" : "#ffffff",
              border: step.highlight ? "2px solid #3b82f6" : "1px solid #e5e7eb",
              borderRadius: 10,
              textDecoration: "none",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              transition: "transform 0.15s, box-shadow 0.15s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
            }}
          >
            {/* Step number + emoji */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <div style={{
                width: 22, height: 22,
                borderRadius: "50%",
                backgroundColor: step.highlight ? "#3b82f6" : "#e5e7eb",
                color: step.highlight ? "#ffffff" : "#374151",
                fontSize: "0.7rem", fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {step.number}
              </div>
              <span style={{ fontSize: "1.2rem" }}>{step.emoji}</span>
            </div>

            <h3 style={{
              fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.35rem",
              color: step.highlight ? "#ffffff" : "#111827",
            }}>
              {step.title}
            </h3>
            <p style={{
              fontSize: "0.76rem", lineHeight: 1.45, margin: "0 0 0.75rem",
              color: step.highlight ? "#94a3b8" : "#6b7280",
              flex: 1,
            }}>
              {step.description}
            </p>
            {step.cta && (
              <span style={{
                fontSize: "0.78rem", fontWeight: 700,
                color: step.highlight ? "#60a5fa" : "#2563eb",
              }}>
                {step.cta}
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
