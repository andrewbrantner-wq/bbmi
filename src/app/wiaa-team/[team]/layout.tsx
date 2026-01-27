import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: { team: string } }
): Promise<Metadata> {
  const teamName = decodeURIComponent(params.team).replace(/-/g, " ");

  return {
    title: `${teamName} – WIAA Basketball Analytics`,
    description: `Advanced analytics, performance metrics, and division insights for ${teamName} from the Brantner Basketball Model Index.`,
    keywords: [
      `${teamName} basketball`,
      "WIAA team analytics",
      "Wisconsin high school basketball",
      "BBMI",
    ],
    openGraph: {
      title: `${teamName} – WIAA Analytics`,
      description: `BBMI analytics profile for ${teamName}.`,
      url: `https://bbmihoops.com/wiaa-team/${params.team}`,
      siteName: "BBMI Hoops",
      type: "website",
    },
  };
}

export default function WIAATeamLayout(
  { children }: { children: React.ReactNode }
) {
  return <>{children}</>;
}