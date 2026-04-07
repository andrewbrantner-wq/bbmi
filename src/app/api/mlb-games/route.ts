import { NextResponse } from "next/server";
import mlbGames from "@/data/betting-lines/mlb-games.json";

export async function GET() {
  return NextResponse.json(mlbGames);
}
