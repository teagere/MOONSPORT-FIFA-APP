export const statusPoints = {
  Active: 0,
  "Knocked out": 0,
  "Round of 32": 5,
  "Round of 16": 10,
  "Quarter-final": 20,
  "Semi-final": 35,
  Finalist: 50,
  Champion: 100,
};

export const statusProgress = {
  "Knocked out": 0,
  Active: 1,
  "Round of 32": 2,
  "Round of 16": 3,
  "Quarter-final": 4,
  "Semi-final": 5,
  Finalist: 6,
  Champion: 7,
};

export function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function recalculateTiers(teams) {
  return [...teams]
    .sort((a, b) => Number(a.fifaRanking) - Number(b.fifaRanking))
    .map((team, index) => ({ ...team, tier: index < 20 ? 1 : 2 }))
    .sort((a, b) => a.country.localeCompare(b.country));
}

export function getTeamsByTier(teams, tier) {
  return teams
    .filter((team) => Number(team.tier) === tier)
    .sort((a, b) => Number(a.fifaRanking) - Number(b.fifaRanking));
}

export function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateDrawPools(staffCount, teams) {
  const tier1 = getTeamsByTier(teams, 1);
  const tier2 = getTeamsByTier(teams, 2);
  const tier1Pool = [];
  const tier2Pool = [];

  // Tier 1 starts with two slips per elite team, then tops up randomly.
  // This gives every top-tier country broad representation before extras appear.
  tier1.forEach((team) => {
    tier1Pool.push(team.id, team.id);
  });

  // Tier 2 starts with one slip per team, then tops up randomly until every
  // staff member can receive exactly one lower-tier country.
  tier2.forEach((team) => tier2Pool.push(team.id));

  while (tier1Pool.length < staffCount && tier1.length) {
    tier1Pool.push(tier1[Math.floor(Math.random() * tier1.length)].id);
  }

  while (tier2Pool.length < staffCount && tier2.length) {
    tier2Pool.push(tier2[Math.floor(Math.random() * tier2.length)].id);
  }

  return {
    tier1Pool: shuffle(tier1Pool).slice(0, staffCount),
    tier2Pool: shuffle(tier2Pool).slice(0, staffCount),
  };
}

export function assignTeams(staff, teams) {
  const pools = generateDrawPools(staff.length, teams);
  const tier1Pool = shuffle(pools.tier1Pool);
  const tier2Pool = shuffle(pools.tier2Pool);
  return staff.map((person, index) => ({
    ...person,
    tier1TeamId: tier1Pool[index] || "",
    tier2TeamId: tier2Pool[index] || "",
  }));
}

export function getTeam(teamId, teams) {
  return teams.find((team) => team.id === teamId);
}

export function calculatePersonStatus(person, teams) {
  const team1 = getTeam(person.tier1TeamId, teams);
  const team2 = getTeam(person.tier2TeamId, teams);
  const statuses = [team1?.status, team2?.status].filter(Boolean);
  if (statuses.includes("Champion")) return "Winner";
  if (!statuses.length) return "Active";
  const activeCount = statuses.filter((status) => status !== "Knocked out").length;
  if (activeCount === 2) return "Active";
  if (activeCount === 1) return "Partially Active";
  return "Knocked Out";
}

export function calculatePoints(person, teams, groupStandings = []) {
  const team1 = getTeam(person.tier1TeamId, teams);
  const team2 = getTeam(person.tier2TeamId, teams);
  const groupPointsByTeam = new Map(groupStandings.map((standing) => [standing.teamId, Number(standing.points) || 0]));
  const groupStagePoints = (groupPointsByTeam.get(team1?.id) || 0) + (groupPointsByTeam.get(team2?.id) || 0);
  const knockoutPoints = (statusPoints[team1?.status] || 0) + (statusPoints[team2?.status] || 0);
  const tier2KnockoutBonus = statusProgress[team2?.status] >= statusProgress["Round of 32"] ? 10 : 0;
  const tier2QuarterBonus = statusProgress[team2?.status] >= statusProgress["Quarter-final"] ? 20 : 0;
  return groupStagePoints + knockoutPoints + tier2KnockoutBonus + tier2QuarterBonus;
}

export function buildLeaderboard(staff, teams, groupStandings = []) {
  return staff
    .map((person) => {
      const team1 = getTeam(person.tier1TeamId, teams);
      const team2 = getTeam(person.tier2TeamId, teams);
      const status = calculatePersonStatus(person, teams);
      const points = calculatePoints(person, teams, groupStandings);
      const badges = [];
      if (status === "Active" || status === "Partially Active") badges.push("Still Alive");
      if (status === "Knocked Out") badges.push("Both Teams Out");
      if ([team1?.status, team2?.status].includes("Champion")) badges.push("Has Champion");
      if (team2 && statusProgress[team2.status] >= statusProgress["Quarter-final"]) badges.push("Best Tier 2 Run");
      return { ...person, team1, team2, status, points, badges };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function calculatePrizeWinners(prizes, staff, teams) {
  const leaderboard = buildLeaderboard(staff, teams);
  const championTeamIds = teams.filter((team) => team.status === "Champion").map((team) => team.id);
  const finalistTeamIds = teams.filter((team) => team.status === "Finalist").map((team) => team.id);
  const bestTier2Progress = Math.max(0, ...teams.filter((team) => team.tier === 2).map((team) => statusProgress[team.status] || 0));
  const bestTier2Ids = teams
    .filter((team) => team.tier === 2 && (statusProgress[team.status] || 0) === bestTier2Progress && bestTier2Progress > 0)
    .map((team) => team.id);
  const topPoints = leaderboard[0]?.points || 0;

  return prizes.map((prize) => {
    let winners = [];
    if (prize.id === "grand-prize") {
      winners = leaderboard.filter((row) => championTeamIds.includes(row.tier1TeamId) || championTeamIds.includes(row.tier2TeamId));
    } else if (prize.id === "runner-up") {
      winners = leaderboard.filter((row) => finalistTeamIds.includes(row.tier1TeamId) || finalistTeamIds.includes(row.tier2TeamId));
    } else if (prize.id === "best-tier-2") {
      winners = leaderboard.filter((row) => bestTier2Ids.includes(row.tier2TeamId));
    } else if (prize.id === "most-points") {
      winners = leaderboard.filter((row) => row.points === topPoints && topPoints > 0);
    } else if (prize.id === "wooden-spoon") {
      winners = leaderboard.filter((row) => row.status === "Knocked Out").slice(-1);
    }
    return { ...prize, winners };
  });
}

export function exportAssignmentsCsv(staff, teams) {
  const rows = [["Name", "Department", "Email", "Tier 1 Team", "Tier 2 Team", "Status", "Points"]];
  buildLeaderboard(staff, teams).forEach((person) => {
    rows.push([
      person.name,
      person.department || "",
      person.email || "",
      person.team1?.country || "",
      person.team2?.country || "",
      person.status,
      person.points,
    ]);
  });
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

export function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}
