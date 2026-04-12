"use client";

import { use } from "react";
import { redirect } from "next/navigation";

export default function NFLTeamRedirect({ params }: { params: Promise<{ team: string }> }) {
  const { team } = use(params);
  redirect(`/nfl/teams/${team}`);
}
