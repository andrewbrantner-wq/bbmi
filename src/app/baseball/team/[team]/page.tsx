import BaseballTeamClient from "./BaseballTeamClient";

export async function generateMetadata(
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params;
  const teamName = decodeURIComponent(team);
  return {
    title: `${teamName} – NCAA Baseball Team Profile`,
    description: `Schedule, results, BBMI ranking, and analytics for ${teamName} in NCAA D1 baseball.`,
    openGraph: {
      title: `${teamName} – NCAA Baseball Profile`,
      description: `Full baseball analytics profile for ${teamName}.`,
      url: `https://bbmisports.com/baseball/team/${team}`,
      siteName: "BBMI Sports",
    },
  };
}

export default async function Page(
  { params }: { params: Promise<{ team: string }> }
) {
  const resolvedParams = await params;
  return <BaseballTeamClient params={resolvedParams} />;
}
