import { Metadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ team: string }> }
): Promise<Metadata> {
  const { team } = await params;  // ✅ Await the params
  const teamName = decodeURIComponent(team).replace(/-/g, " ");

  return {
    title: `${teamName} – WIAA Basketball Analytics`,
    description: `View ${teamName}'s schedule, game predictions, and win probabilities powered by BBMI.`,
  };
}

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
