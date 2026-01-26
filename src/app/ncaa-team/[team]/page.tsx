import TeamClient from "./TeamClient";

export async function generateMetadata({ params }) {
  const teamName = decodeURIComponent(params.team);

  return {
    title: `${teamName} – WIAA Team Profile`,
    description: `Schedule, results, BBMI ranking, and analytics for ${teamName} in WIAA boys varsity basketball.`,
    openGraph: {
      title: `${teamName} – WIAA Team Profile`,
      description: `Full WIAA analytics profile for ${teamName}.`,
      url: `https://bbmihoops.com/wiaa-team/${params.team}`,
      siteName: "BBMI Hoops",
    },
  };
}

export default function Page({ params }) {
  return <TeamClient params={params} />;
}