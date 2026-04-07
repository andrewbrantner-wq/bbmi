import { NextResponse } from "next/server";
import ncaabGames from "@/data/betting-lines/games.json";

export async function GET() {
  return NextResponse.json(ncaabGames);
}
