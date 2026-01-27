"use client";

type TeamClientProps = {
  team: string;
};

export default function TeamClient({ team }: TeamClientProps) {
  return (
    <div style={{ padding: "1rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>
        {team} — WIAA Team Profile
      </h1>

      {/* 
        Add your UI here:
        - Schedule table
        - Results
        - BBMI ranking
        - Analytics
        - Charts
        - Remaining games
        - Anything interactive
      */}

      <p style={{ marginTop: "1rem", opacity: 0.7 }}>
        Loading team data for {team}...
      </p>
    </div>
  );
}