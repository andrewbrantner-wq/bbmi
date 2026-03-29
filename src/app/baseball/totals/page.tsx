"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect to Today's Picks with O/U mode.
// The Over/Under tab was merged into the Today's Picks page (2026-03-29).
// This redirect preserves bookmarks and external links.
export default function BaseballTotalsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/baseball/picks?mode=ou");
  }, [router]);
  return (
    <div style={{ textAlign: "center", padding: 60, color: "#78716c" }}>
      Redirecting to Today&apos;s Picks...
    </div>
  );
}
