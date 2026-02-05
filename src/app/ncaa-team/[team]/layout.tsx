import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ team: string }> }
): Promise<Metadata> {
  const { team } = await params;
  const teamName = decodeURIComponent(team).replace(/-/g, " ");

  return {
    title: `${teamName} – NCAA Basketball Analytics`,
    description: `Advanced analytics, efficiency metrics, and matchup insights for ${teamName} from the Brantner Basketball Model Index.`,
    openGraph: {
      title: `${teamName} – NCAA Analytics`,
      description: `BBMI analytics profile for ${teamName}.`,
      url: `https://bbmihoops.com/ncaa-team/${team}`,
      siteName: "BBMI Hoops",
      type: "website",
    },
  };
}

export default function NCAATeamLayout(
  { children }: { children: React.ReactNode }
) {
  return <>{children}</>;
}
