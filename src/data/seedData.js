import { recalculateTiers } from "../utils/tournament.js";

export const STAGES = [
  "Group Stage",
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Final",
  "Champion",
];

export const TEAM_STATUSES = [
  "Active",
  "Knocked out",
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Finalist",
  "Champion",
];

const bracketRounds = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];

export function createDefaultBracket() {
  return bracketRounds.map((name, roundIndex) => ({
    name,
    matches: Array.from({ length: Math.max(1, 16 / 2 ** roundIndex) }, (_, matchIndex) => ({
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${matchIndex + 1}`,
      teamAId: "",
      teamBId: "",
      winnerId: "",
    })),
  }));
}

export function createDefaultThirdPlaceMatch() {
  return {
    id: "third-place-playoff",
    teamAId: "",
    teamBId: "",
    winnerId: "",
  };
}

const rawTeams = [
  ["Mexico", "🇲🇽", 15, "A"],
  ["South Korea", "🇰🇷", 25, "A"],
  ["South Africa", "🇿🇦", 60, "A"],
  ["Czech Republic", "🇨🇿", 41, "A"],
  ["Canada", "🇨🇦", 30, "B"],
  ["Switzerland", "🇨🇭", 19, "B"],
  ["Qatar", "🇶🇦", 55, "B"],
  ["Bosnia & Herzegovina", "🇧🇦", 65, "B"],
  ["Brazil", "🇧🇷", 6, "C"],
  ["Morocco", "🇲🇦", 8, "C"],
  ["Scotland", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", 43, "C"],
  ["Haiti", "🇭🇹", 83, "C"],
  ["USA", "🇺🇸", 16, "D"],
  ["Paraguay", "🇵🇾", 40, "D"],
  ["Australia", "🇦🇺", 27, "D"],
  ["Turkiye", "🇹🇷", 22, "D"],
  ["Germany", "🇩🇪", 10, "E"],
  ["Ecuador", "🇪🇨", 23, "E"],
  ["Ivory Coast", "🇨🇮", 34, "E"],
  ["Curacao", "🇨🇼", 82, "E"],
  ["Netherlands", "🇳🇱", 7, "F"],
  ["Japan", "🇯🇵", 18, "F"],
  ["Tunisia", "🇹🇳", 44, "F"],
  ["Sweden", "🇸🇪", 38, "F"],
  ["Belgium", "🇧🇪", 9, "G"],
  ["Iran", "🇮🇷", 21, "G"],
  ["Egypt", "🇪🇬", 29, "G"],
  ["New Zealand", "🇳🇿", 85, "G"],
  ["Spain", "🇪🇸", 2, "H"],
  ["Uruguay", "🇺🇾", 17, "H"],
  ["Saudi Arabia", "🇸🇦", 61, "H"],
  ["Cape Verde", "🇨🇻", 69, "H"],
  ["France", "🇫🇷", 1, "I"],
  ["Senegal", "🇸🇳", 14, "I"],
  ["Norway", "🇳🇴", 31, "I"],
  ["Iraq", "🇮🇶", 57, "I"],
  ["Argentina", "🇦🇷", 3, "J"],
  ["Algeria", "🇩🇿", 28, "J"],
  ["Austria", "🇦🇹", 24, "J"],
  ["Jordan", "🇯🇴", 63, "J"],
  ["Portugal", "🇵🇹", 5, "K"],
  ["Colombia", "🇨🇴", 13, "K"],
  ["Uzbekistan", "🇺🇿", 50, "K"],
  ["DR Congo", "🇨🇩", 46, "K"],
  ["England", "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", 4, "L"],
  ["Croatia", "🇭🇷", 11, "L"],
  ["Ghana", "🇬🇭", 74, "L"],
  ["Panama", "🇵🇦", 33, "L"],
];

export const seedTeams = recalculateTiers(
  rawTeams.map(([country, flag, fifaRanking, group], index) => ({
    id: `team-${index + 1}`,
    country,
    flag,
    fifaRanking,
    tier: 2,
    group,
    status: "Active",
  }))
);

export function createDefaultGroupStandings(teams = seedTeams) {
  return teams.map((team) => ({
    teamId: team.id,
    group: team.group || "",
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

export const seedStaff = [
  "Amy Langston",
  "Angus Opperman",
  "Annemie Bester",
  "Bonke Lento",
  "Candice Bresler",
  "Carisa Liebenberg",
  "Carly Dunbar",
  "Catherine Matthews",
  "Chene Caine",
  "Christiaan Coetsee",
  "Codi Rinkwest",
  "David Lim",
  "Dean Petersen",
  "Deon Chetty",
  "Dixie Cornell",
  "Dylan Jack",
  "Jared Epstein",
  "Jason Mitchell",
  "Jeremy Ryall",
  "Jody Taylor",
  "Jonty Mylne",
  "Kristen Brown",
  "Kyle De Vree",
  "Leezil Hendricks",
  "Louis Janse Van Rensburg",
  "Monique Vrey",
  "Myles Hoppe",
  "Nadine Hendricks",
  "Seth O'Dea",
  "Simon Key",
  "Sipumelele Mnikina",
  "Taswald Christian",
  "Teager Eales",
  "Thabiso May",
  "Trent Key",
  "Vuyo Ncube",
  "Warren Fortune",
].map((name, index) => ({
  id: `staff-${index + 1}`,
  name,
  department: "",
  email: "",
  tier1TeamId: "",
  tier2TeamId: "",
}));

export const defaultPrizes = [
  {
    id: "grand-prize",
    name: "Grand Prize",
    description: "Person or people with the World Cup-winning team.",
  },
  {
    id: "runner-up",
    name: "Runner-up Prize",
    description: "Person or people with the losing finalist.",
  },
  {
    id: "best-tier-2",
    name: "Best Tier 2 Run",
    description: "Person or people with the furthest progressing Tier 2 team.",
  },
  {
    id: "most-points",
    name: "Most Points",
    description: "Top leaderboard points.",
  },
  {
    id: "spirit-prize",
    name: "Moonsport Spirit Prize",
    description: "Manual award.",
  },
  {
    id: "wooden-spoon",
    name: "Wooden Spoon",
    description: "First person with both teams knocked out.",
  },
];

export const seedState = {
  settings: {
    tournamentName: "Moonsport Road to the Final",
    currentStage: "Group Stage",
    drawLocked: false,
    teamsLocked: false,
    liveDrawIndex: 0,
    drawPools: null,
    dataVersion: "fifa-official-rankings-2026-05-19-foundation",
    staffVersion: "moonsport-staff-2026-06-06",
    dataSource: "FIFA World Cup 2026 teams page and FIFA approved men's rankings API",
  },
  staff: seedStaff,
  teams: seedTeams,
  prizes: defaultPrizes,
  recentEliminations: [],
  groupStandings: createDefaultGroupStandings(seedTeams),
  bracket: createDefaultBracket(),
  bracketThirdPlace: createDefaultThirdPlaceMatch(),
};
