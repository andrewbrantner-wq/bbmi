import TeamClient from "./TeamClient";

export async function generateMetadata(
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params;
  const teamName = decodeURIComponent(team);

  return {
    title: `${teamName} – NCAA Team Profile`,
    description: `Schedule, results, BBMI ranking, and analytics for ${teamName} in NCAA men's basketball.`,
    openGraph: {
      title: `${teamName} – NCAA Team Profile`,
      description: `Full NCAA analytics profile for ${teamName}.`,
      url: `https://bbmihoops.com/ncaa-team/${team}`,
      siteName: "BBMI Hoops",
    },
  };
}

export default async function Page(
  { params }: { params: Promise<{ team: string }> }
) {
  const resolvedParams = await params;
  return <TeamClient params={resolvedParams} />;
}
