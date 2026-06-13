import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_STATE_ID = "main";
const FOOTBALL_DATA_STANDINGS_URL = "https://api.football-data.org/v4/competitions/WC/standings?season=2026";
const FOOTBALL_DATA_MATCHES_URL = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";

const TEAM_NAME_ALIASES: Record<string, string> = {
  "bosnia and herzegovina": "Bosnia & Herzegovina",
  "bosnia herzegovina": "Bosnia & Herzegovina",
  "bosnia-herzegovina": "Bosnia & Herzegovina",
  "bosnia & herzegovina": "Bosnia & Herzegovina",
  "czechia": "Czech Republic",
  "czech republic": "Czech Republic",
  "cote d'ivoire": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "cote divoire": "Ivory Coast",
  "ivory coast": "Ivory Coast",
  "cabo verde": "Cape Verde",
  "cape verde": "Cape Verde",
  "cape verde islands": "Cape Verde",
  "curacao": "Curacao",
  "curaçao": "Curacao",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
  "d r congo": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "ir iran": "Iran",
  "korea republic": "South Korea",
  "republic of korea": "South Korea",
  "south korea": "South Korea",
  "turkey": "Turkiye",
  "türkiye": "Turkiye",
  "turkiye": "Turkiye",
  "united states": "USA",
  "usa": "USA",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeName(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalCountryName(value = "") {
  const normalized = normalizeName(value);
  return TEAM_NAME_ALIASES[normalized] || value;
}

function getRateLimitHeaders(response: Response) {
  return {
    minuteAvailable: response.headers.get("X-Requests-Available-Minute"),
    dayAvailable: response.headers.get("X-Requests-Available-Day"),
    reset: response.headers.get("X-RequestCounter-Reset"),
  };
}

function getSupabaseSecretKey() {
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeysJson) return "";

  try {
    const secretKeys = JSON.parse(secretKeysJson);
    return Object.values(secretKeys).find((value) => typeof value === "string") || "";
  } catch {
    return "";
  }
}

function hasMeaningfulStandingData(standing: Record<string, unknown> = {}) {
  return [
    "played",
    "won",
    "drawn",
    "lost",
    "goalsFor",
    "goalsAgainst",
    "points",
  ].some((field) => Number(standing[field] || 0) !== 0);
}

function emptyStanding(team: { id: string; group?: string }) {
  return {
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
  };
}

function applyMatchResult(
  standing: Record<string, unknown>,
  goalsFor: number,
  goalsAgainst: number,
) {
  standing.played = Number(standing.played || 0) + 1;
  standing.goalsFor = Number(standing.goalsFor || 0) + goalsFor;
  standing.goalsAgainst = Number(standing.goalsAgainst || 0) + goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.won = Number(standing.won || 0) + 1;
    standing.points = Number(standing.points || 0) + 3;
  } else if (goalsFor === goalsAgainst) {
    standing.drawn = Number(standing.drawn || 0) + 1;
    standing.points = Number(standing.points || 0) + 1;
  } else {
    standing.lost = Number(standing.lost || 0) + 1;
  }
}

function sortGroupStandings(standings: Record<string, unknown>[]) {
  return standings
    .slice()
    .sort((a, b) => {
      const goalDifferenceA = Number(a.goalsFor || 0) - Number(a.goalsAgainst || 0);
      const goalDifferenceB = Number(b.goalsFor || 0) - Number(b.goalsAgainst || 0);
      return (
        Number(b.points || 0) - Number(a.points || 0) ||
        goalDifferenceB - goalDifferenceA ||
        Number(b.goalsFor || 0) - Number(a.goalsFor || 0) ||
        String(a.teamId || "").localeCompare(String(b.teamId || ""))
      );
    })
    .map((standing, index) => ({ ...standing, position: index + 1 }));
}

Deno.serve(async () => {
  const footballDataToken = Deno.env.get("FOOTBALL_DATA_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = getSupabaseSecretKey();

  if (!footballDataToken || !supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Missing required Supabase secrets" }, 500);
  }

  const footballResponse = await fetch(FOOTBALL_DATA_STANDINGS_URL, {
    headers: {
      "X-Auth-Token": footballDataToken,
    },
  });
  const matchesResponse = await fetch(FOOTBALL_DATA_MATCHES_URL, {
    headers: {
      "X-Auth-Token": footballDataToken,
    },
  });

  const rateLimit = getRateLimitHeaders(footballResponse);

  if (!footballResponse.ok) {
    return jsonResponse(
      {
        error: "football-data.org request failed",
        status: footballResponse.status,
        rateLimit,
        details: await footballResponse.text(),
      },
      502
    );
  }

  const footballData = await footballResponse.json();
  const matchesData = matchesResponse.ok ? await matchesResponse.json() : { matches: [] };
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: appStateRow, error: loadError } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", APP_STATE_ID)
    .single();

  if (loadError) {
    return jsonResponse({ error: "Could not load app state", details: loadError.message }, 500);
  }

  const appState = appStateRow?.data || {};
  const teams = Array.isArray(appState.teams) ? appState.teams : [];
  const teamByCountry = new Map(teams.map((team: { country: string; id: string }) => [normalizeName(team.country), team]));
  const existingStandings = Array.isArray(appState.groupStandings) ? appState.groupStandings : [];
  const existingByTeamId = new Map(existingStandings.map((standing: { teamId: string }) => [standing.teamId, standing]));
  const syncedTeamIds = new Set<string>();
  const unmatchedApiTeams = new Set<string>();
  const calculatedByTeamId = new Map<string, Record<string, unknown>>();
  let finishedGroupMatchesSynced = 0;

  const nextStandings = [...existingStandings];

  teams.forEach((team: { id: string; group?: string }) => {
    calculatedByTeamId.set(team.id, emptyStanding(team));
  });

  for (const match of matchesData.matches || []) {
    if (match.status !== "FINISHED") continue;
    if (match.stage && match.stage !== "GROUP_STAGE") continue;

    const homeGoals = Number(match.score?.fullTime?.home);
    const awayGoals = Number(match.score?.fullTime?.away);
    if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;

    const homeCountry = canonicalCountryName(match.homeTeam?.name || match.homeTeam?.shortName || "");
    const awayCountry = canonicalCountryName(match.awayTeam?.name || match.awayTeam?.shortName || "");
    const homeTeam = teamByCountry.get(normalizeName(homeCountry));
    const awayTeam = teamByCountry.get(normalizeName(awayCountry));

    if (!homeTeam || !awayTeam) {
      if (!homeTeam) unmatchedApiTeams.add(match.homeTeam?.name || match.homeTeam?.shortName || "Unknown home team");
      if (!awayTeam) unmatchedApiTeams.add(match.awayTeam?.name || match.awayTeam?.shortName || "Unknown away team");
      continue;
    }

    applyMatchResult(calculatedByTeamId.get(homeTeam.id) || emptyStanding(homeTeam), homeGoals, awayGoals);
    applyMatchResult(calculatedByTeamId.get(awayTeam.id) || emptyStanding(awayTeam), awayGoals, homeGoals);
    finishedGroupMatchesSynced += 1;
  }

  const groups = [...new Set(teams.map((team: { group?: string }) => team.group).filter(Boolean))];
  groups.forEach((group) => {
    const groupRows = [...calculatedByTeamId.values()].filter((standing) => standing.group === group);
    sortGroupStandings(groupRows).forEach((standing) => calculatedByTeamId.set(String(standing.teamId), standing));
  });

  for (const standingGroup of footballData.standings || []) {
    for (const row of standingGroup.table || []) {
      const country = canonicalCountryName(row.team?.name || row.team?.shortName || "");
      const team = teamByCountry.get(normalizeName(country));
      if (!team) {
        unmatchedApiTeams.add(row.team?.name || row.team?.shortName || "Unknown team");
        continue;
      }

      const existingStanding = existingByTeamId.get(team.id) || {};
      const nextStanding = {
        ...existingStanding,
        teamId: team.id,
        group: String(standingGroup.group || team.group || "").replace(/^GROUP_?/i, ""),
        position: Number(row.position) || 0,
        played: Number(row.playedGames) || 0,
        won: Number(row.won) || 0,
        drawn: Number(row.draw) || 0,
        lost: Number(row.lost) || 0,
        goalsFor: Number(row.goalsFor) || 0,
        goalsAgainst: Number(row.goalsAgainst) || 0,
        points: Number(row.points) || 0,
      };

      // football-data.org can lag behind live results and return blank 0-0-0 rows.
      // Keep manually entered standings when the API row is still empty, so the
      // scheduled sync cannot wipe the office leaderboard back to zero.
      if (!hasMeaningfulStandingData(nextStanding) && hasMeaningfulStandingData(existingStanding)) {
        syncedTeamIds.add(team.id);
        continue;
      }

      const calculatedStanding = calculatedByTeamId.get(team.id);
      const existingPlayed = Number(existingStanding.played || 0);
      const calculatedPlayed = Number(calculatedStanding?.played || 0);

      if (calculatedStanding && calculatedPlayed > 0 && calculatedPlayed >= existingPlayed) {
        Object.assign(nextStanding, calculatedStanding);
      } else if (calculatedStanding && calculatedPlayed < existingPlayed) {
        Object.assign(nextStanding, existingStanding);
      }

      const existingIndex = nextStandings.findIndex((standing: { teamId: string }) => standing.teamId === team.id);
      if (existingIndex >= 0) {
        nextStandings[existingIndex] = nextStanding;
      } else {
        nextStandings.push(nextStanding);
      }

      syncedTeamIds.add(team.id);
    }
  }

  const missingAppTeams = teams
    .filter((team: { id: string }) => !syncedTeamIds.has(team.id))
    .map((team: { country: string }) => team.country)
    .sort();

  const nextState = {
    ...appState,
    groupStandings: nextStandings,
    settings: {
      ...(appState.settings || {}),
      autoSync: {
        source: "football-data.org",
        lastSyncedAt: new Date().toISOString(),
        syncedTeams: syncedTeamIds.size,
        finishedGroupMatchesSynced,
        totalTeams: teams.length,
        missingAppTeams,
        unmatchedApiTeams: [...unmatchedApiTeams].sort(),
        rateLimit,
      },
    },
  };

  const { error: saveError } = await supabase
    .from("app_state")
    .upsert({ id: APP_STATE_ID, data: nextState, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (saveError) {
    return jsonResponse({ error: "Could not save app state", details: saveError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    source: "football-data.org",
    syncedTeams: syncedTeamIds.size,
    finishedGroupMatchesSynced,
    totalTeams: teams.length,
    missingAppTeams,
    unmatchedApiTeams: [...unmatchedApiTeams].sort(),
    rateLimit,
  });
});
