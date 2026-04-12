"use client";

import { redirect } from "next/navigation";

export default function NFLAccuracyRedirect() {
  redirect("/nfl/season");
}
