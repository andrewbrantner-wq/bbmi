import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ team: string }> }
): Promise<Metadata> {
  const { team } = await params;
  const teamName = decodeURIComponent(team).replace(/-/g, " ");
  return {
    title: `${teamName} – NCAA Baseball Analytics`,
    description: `Advanced analytics and schedule for ${teamName} from the BBMI Baseball model.`,
    openGraph: {
      title: `${teamName} – Baseball Analytics`,
      description: `BBMI baseball profile for ${teamName}.`,
      url: `https://bbmisports.com/baseball/team/${team}`,
      siteName: "BBMI Sports",
    },
  };
}

export default function BaseballTeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
