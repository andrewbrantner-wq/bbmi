"use client";

import { redirect } from "next/navigation";

export default function NFLPicksRedirect() {
  redirect("/nfl/games");
}
