import React, { useEffect, useMemo, useState } from "react";
import { createDefaultBracket, createDefaultGroupStandings, createDefaultThirdPlaceMatch, seedState, TEAM_STATUSES } from "./data/seedData.js";
import {
  buildLeaderboard,
  calculatePersonStatus,
  downloadFile,
  exportJson,
  generateDrawPools,
  getTeam,
  getTeamsByTier,
  recalculateTiers,
} from "./utils/tournament.js";

const STORAGE_KEY = "moonsport-road-to-final-state";
const DATA_VERSION = "fifa-official-rankings-2026-05-19-foundation";
const MANAGER_PASSWORD = "1111";
const FIFA_STANDINGS_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings";

const managerViews = ["Manager", "Teams", "Draw Setup", "Live Draw"];
const publicNavViews = ["Leaderboard", "Bracket"];
const publicViews = ["Leaderboard", "Bracket"];

const officialWarning =
  "Team rankings data is seeded from the official FIFA World Cup 2026 teams page and FIFA approved men’s rankings data.";

function restoreOfficialTeams(existingTeams = []) {
  const existingById = new Map(existingTeams.map((team) => [team.id, team]));
  return recalculateTiers(
    seedState.teams.map((seedTeam) => ({
      ...seedTeam,
      status: existingById.get(seedTeam.id)?.status || seedTeam.status,
    }))
  );
}

function normalizeState(input) {
  const stored = input || seedState;
  const shouldRestoreTeams = stored.settings?.dataVersion !== DATA_VERSION || stored.teams?.length !== 48;
  const teams = shouldRestoreTeams ? restoreOfficialTeams(stored.teams) : recalculateTiers(stored.teams);
  const validTeamIds = new Set(teams.map((team) => team.id));
  const groupStandings = normalizeGroupStandings(stored.groupStandings, teams);
  const staff = (stored.staff?.length ? stored.staff : seedState.staff).map((person) => ({
    ...person,
    tier1TeamId: validTeamIds.has(person.tier1TeamId) ? person.tier1TeamId : "",
    tier2TeamId: validTeamIds.has(person.tier2TeamId) ? person.tier2TeamId : "",
  }));

  return {
    ...seedState,
    ...stored,
    teams,
    staff,
    groupStandings,
    bracket: stored.bracket?.length ? stored.bracket : createDefaultBracket(),
    bracketThirdPlace: stored.bracketThirdPlace || createDefaultThirdPlaceMatch(),
    settings: {
      ...seedState.settings,
      ...stored.settings,
      dataVersion: DATA_VERSION,
      dataSource: seedState.settings.dataSource,
      drawPools: shouldRestoreTeams ? null : stored.settings?.drawPools || null,
    },
  };
}

function normalizeGroupStandings(storedStandings, teams) {
  const standingByTeam = new Map((storedStandings || []).map((standing) => [standing.teamId, standing]));
  return createDefaultGroupStandings(teams).map((standing) => ({
    ...standing,
    ...standingByTeam.get(standing.teamId),
    group: teams.find((team) => team.id === standing.teamId)?.group || standing.group,
  }));
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedState);
  } catch {
    return normalizeState(seedState);
  }
}

function App() {
  const [state, setState] = useState(loadState);
  const [activeView, setActiveView] = useState("Leaderboard");
  const [unlockedView, setUnlockedView] = useState(null);
  const [managerMenuOpen, setManagerMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const leaderboard = useMemo(() => buildLeaderboard(state.staff, state.teams, state.groupStandings), [state.staff, state.teams, state.groupStandings]);
  const tier1 = useMemo(() => getTeamsByTier(state.teams, 1), [state.teams]);
  const tier2 = useMemo(() => getTeamsByTier(state.teams, 2), [state.teams]);
  const validTeamList = state.teams.length === 48 && tier1.length === 20 && tier2.length === 28;

  function updateState(patch) {
    setState((current) => ({ ...current, ...patch }));
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function openView(view) {
    setActiveView(view);
    setUnlockedView(null);
    setManagerMenuOpen(false);
  }

  const canEditActiveView = unlockedView === activeView;
  const shared = {
    state,
    updateState,
    showToast,
    leaderboard,
    tier1,
    tier2,
    validTeamList,
    setActiveView: openView,
    canEdit: canEditActiveView,
    unlockCurrentView: () => setUnlockedView(activeView),
  };
  const viewMap = {
    Manager: <ManagerWorkspace {...shared} />,
    Teams: <Teams {...shared} />,
    "Draw Setup": <DrawSetup {...shared} />,
    "Live Draw": <LiveDraw {...shared} />,
    Leaderboard: <LeaderboardHub {...shared} />,
    Bracket: <BracketTab {...shared} />,
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-black/25">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="brand-lockup">
            <img className="brand-wordmark" src="./brand/moonsport-wordmark-white.png" alt="Moonsport" />
            <p className="brand-kicker">FIFA World Cup 2026</p>
          </div>
          <div className="header-actions">
          <nav className="top-nav">
            <div className="manager-nav">
              <button
                className={`btn ${managerViews.includes(activeView) ? "border-lime/70 bg-lime text-midnight" : "bg-white/[0.04] text-white/80"}`}
                onClick={() => setManagerMenuOpen((isOpen) => !isOpen)}
                aria-expanded={managerMenuOpen}
                aria-haspopup="menu"
              >
                Manager
              </button>
              {managerMenuOpen && (
                <div className="manager-menu" role="menu">
                  {managerViews.map((view) => (
                    <button
                      key={view}
                      className={`manager-menu-item ${activeView === view ? "is-active" : ""}`}
                      onClick={() => openView(view)}
                      role="menuitem"
                    >
                      {view}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {publicNavViews.map((view) => (
              <button
                key={view}
                className={`btn ${activeView === view ? "border-lime/70 bg-lime text-midnight" : "bg-white/[0.04] text-white/80"}`}
                onClick={() => openView(view)}
              >
                {view}
              </button>
            ))}
          </nav>
          <img className="brand-icon" src="./brand/moonsport-icon-white.png" alt="" aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        {publicViews.includes(activeView) || canEditActiveView ? (
          viewMap[activeView]
        ) : (
          <TabAccessGate view={activeView} onUnlock={() => setUnlockedView(activeView)} showToast={showToast} />
        )}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-lime/40 bg-lime px-4 py-3 text-sm font-bold text-midnight shadow-glow">
          {toast}
        </div>
      )}
    </div>
  );
}

function EditUnlockPanel({ label = "editing", onUnlock, showToast }) {
  const [password, setPassword] = useState("");

  function submitPassword(event) {
    event.preventDefault();
    if (password === MANAGER_PASSWORD) {
      setPassword("");
      onUnlock();
      return;
    }
    showToast("Incorrect password");
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-moon">View only</p>
          <p className="mt-1 text-sm text-white/65">Enter the password to unlock {label}.</p>
        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={submitPassword}>
          <input className="field" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="btn btn-primary">Open</button>
        </form>
      </div>
    </section>
  );
}

function TabAccessGate({ view, onUnlock, showToast }) {
  const [password, setPassword] = useState("");

  function submitPassword(event) {
    event.preventDefault();
    if (password === MANAGER_PASSWORD) {
      setPassword("");
      onUnlock();
      return;
    }
    showToast("Incorrect password");
  }

  return (
    <section className="panel mx-auto max-w-xl p-6">
      <p className="text-sm font-bold uppercase tracking-[0.28em] text-moon">Protected tab</p>
      <h2 className="mt-2 text-3xl font-black">{view}</h2>
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={submitPassword}>
        <input className="field" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        <button className="btn btn-primary">Open</button>
      </form>
    </section>
  );
}

function WarningBanner({ validTeamList }) {
  return (
    <div className={`panel mb-5 p-4 ${validTeamList ? "border-gold/30" : "border-red-400/40 bg-red-500/10"}`}>
      <p className="font-bold text-gold">{officialWarning}</p>
      {!validTeamList && <p className="mt-2 text-sm text-red-100">The app restored the official 48-team list. Refresh if you still see missing teams.</p>}
    </div>
  );
}

function StatCard({ label, value, tone = "text-white" }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/50">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ManagerWorkspace({ state, updateState, showToast, leaderboard }) {
  const [form, setForm] = useState({ name: "" });
  const [bulk, setBulk] = useState("");

  function addStaff(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    updateState({
      staff: [...state.staff, { id: crypto.randomUUID(), name: form.name.trim(), department: "", email: "", tier1TeamId: "", tier2TeamId: "" }],
    });
    setForm({ name: "" });
  }

  function bulkAdd() {
    const names = bulk.split("\n").map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    updateState({
      staff: [...state.staff, ...names.map((name) => ({ id: crypto.randomUUID(), name, department: "", email: "", tier1TeamId: "", tier2TeamId: "" }))],
      settings: { ...state.settings, drawPools: null },
    });
    setBulk("");
    showToast("Participants added");
  }

  function updateStaff(id, field, value) {
    updateState({ staff: state.staff.map((person) => (person.id === id ? { ...person, [field]: value } : person)) });
  }

  function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        updateState(normalizeState(JSON.parse(String(reader.result))));
        showToast("Backup restored");
      } catch {
        showToast("Backup file could not be restored");
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.4fr]">
      <section className="space-y-5">
        <form className="panel p-5" onSubmit={addStaff}>
          <h2 className="text-xl font-black">Participants</h2>
          <div className="mt-4 grid gap-3">
            <input className="field" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <button className="btn btn-primary">Add Person</button>
          </div>
        </form>

        <section className="panel p-5">
          <h2 className="text-xl font-black">Bulk Upload</h2>
          <textarea className="field mt-4 min-h-36" placeholder="Paste one participant name per line" value={bulk} onChange={(event) => setBulk(event.target.value)} />
          <button className="btn mt-3 w-full bg-white/10" onClick={bulkAdd}>Add Names</button>
        </section>

        <section className="panel p-5">
          <h2 className="text-xl font-black">Data Backup</h2>
          <p className="mt-2 text-sm text-white/60">
            Data auto-saves in this browser for the exact app URL you are using. Keep using the same URL throughout the tournament, and download a backup before major updates or shutdowns for extra safety.
          </p>
          <div className="mt-4 grid gap-3">
            <button className="btn bg-white/10" onClick={() => downloadFile("moonsport-road-to-final-backup.json", exportJson(state), "application/json")}>Download Backup</button>
            <label className="btn bg-white/10">
              Restore Backup
              <input className="sr-only" type="file" accept="application/json,.json" onChange={restoreBackup} />
            </label>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <div className="panel p-5">
          <h2 className="text-xl font-black">Participant List</h2>
          <LeaderboardTable leaderboard={leaderboard} managerMode onUpdateStaff={updateStaff} onDeleteStaff={(id) => updateState({ staff: state.staff.filter((person) => person.id !== id) })} />
        </div>
      </section>
    </div>
  );
}

function Teams({ state, updateState, showToast, tier1, tier2, validTeamList }) {
  const locked = Boolean(state.settings.teamsLocked);

  function updateTeam(id, field, value) {
    updateState({
      teams: recalculateTiers(
        state.teams.map((team) => (team.id === id ? { ...team, [field]: field === "fifaRanking" ? Number(value) : value } : team))
      ),
    });
  }

  function restoreTeams() {
    updateState({
      teams: restoreOfficialTeams(state.teams),
      settings: { ...state.settings, drawPools: null },
    });
    showToast("Official 48 teams restored");
  }

  return (
    <>
      <WarningBanner validTeamList={validTeamList} />
      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <StatCard label="Total teams" value={state.teams.length} tone={validTeamList ? "text-lime" : "text-red-200"} />
        <StatCard label="Tier 1" value={tier1.length} />
        <StatCard label="Tier 2" value={tier2.length} />
        <StatCard label="Team setup" value={locked ? "Locked" : "Open"} tone={locked ? "text-lime" : "text-gold"} />
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">Teams</h2>
            <p className="mt-1 text-sm text-white/60">Lock the official team structure before the draw. Status can still be changed as the tournament progresses.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn bg-white/10" onClick={restoreTeams}>Restore 48 Teams</button>
            <button className="btn bg-white/10" disabled={locked} onClick={() => updateState({ teams: recalculateTiers(state.teams) })}>Recalculate Tiers</button>
            <button className="btn btn-primary" onClick={() => updateState({ settings: { ...state.settings, teamsLocked: true } })}>Lock Teams</button>
            <button className="btn bg-white/10" onClick={() => updateState({ settings: { ...state.settings, teamsLocked: false } })}>Edit Teams</button>
          </div>
        </div>

        <div className="table-wrap mt-5">
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>Flag</th>
                <th>Ranking</th>
                <th>Tier</th>
                <th>Group</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...state.teams].sort((a, b) => a.fifaRanking - b.fifaRanking).map((team) => (
                <tr key={team.id}>
                  <td><input className="field" value={team.country} disabled={locked} onChange={(event) => updateTeam(team.id, "country", event.target.value)} /></td>
                  <td><input className="field max-w-20" value={team.flag} disabled={locked} onChange={(event) => updateTeam(team.id, "flag", event.target.value)} /></td>
                  <td><input className="field max-w-24" type="number" value={team.fifaRanking} disabled={locked} onChange={(event) => updateTeam(team.id, "fifaRanking", event.target.value)} /></td>
                  <td><span className={`badge ${team.tier === 1 ? "border-lime/40 text-lime" : "border-moon/40 text-moon"}`}>Tier {team.tier}</span></td>
                  <td><input className="field max-w-20" value={team.group || ""} disabled={locked} onChange={(event) => updateTeam(team.id, "group", event.target.value)} /></td>
                  <td>
                    <select className="field" value={team.status} onChange={(event) => updateTeam(team.id, "status", event.target.value)}>
                      {TEAM_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DrawSetup({ tier1, tier2, validTeamList }) {
  return (
    <>
      <WarningBanner validTeamList={validTeamList} />
      <section className="grid gap-5 lg:grid-cols-2">
        <TierPanel title="Tier 1" subtitle="20 highest-ranked qualified teams" teams={tier1} />
        <TierPanel title="Tier 2" subtitle="Remaining 28 qualified teams" teams={tier2} />
      </section>
    </>
  );
}

function TierPanel({ title, subtitle, teams }) {
  return (
    <section className="panel p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-white/60">{subtitle}</p>
        </div>
        <span className="badge">{teams.length} teams</span>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {teams.map((team) => (
          <div className="rounded-md border border-white/10 bg-black/25 p-3" key={team.id}>
            <p className="font-black">{team.flag} {team.country}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-white/50">Rank {team.fifaRanking} • Group {team.group || "TBC"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveDraw({ state, updateState, showToast, validTeamList, setActiveView }) {
  const staff = state.staff;
  const index = Math.min(state.settings.liveDrawIndex || 0, Math.max(staff.length - 1, 0));
  const person = staff[index];
  const team1 = getTeam(person?.tier1TeamId, state.teams);
  const team2 = getTeam(person?.tier2TeamId, state.teams);
  const allDrawn = staff.length > 0 && staff.every((entry) => entry.tier1TeamId && entry.tier2TeamId);

  function ensurePools() {
    const pools = state.settings.drawPools;
    if (pools?.tier1Pool?.length || pools?.tier2Pool?.length) return pools;
    return generateDrawPools(staff.length, state.teams);
  }

  function drawTier(tier) {
    if (!staff.length) return showToast("Add participants first");
    if (!validTeamList) return showToast("Restore the 48-team list first");
    const key = tier === 1 ? "tier1TeamId" : "tier2TeamId";
    if (person[key]) return;
    const pools = ensurePools();
    const poolKey = tier === 1 ? "tier1Pool" : "tier2Pool";
    const [teamId, ...remaining] = pools[poolKey] || [];
    if (!teamId) return showToast("No draw slips left");
    updateState({
      staff: staff.map((entry) => (entry.id === person.id ? { ...entry, [key]: teamId } : entry)),
      settings: { ...state.settings, drawPools: { ...pools, [poolKey]: remaining } },
    });
  }

  function move(delta) {
    updateState({ settings: { ...state.settings, liveDrawIndex: Math.min(Math.max(index + delta, 0), staff.length - 1) } });
  }

  function autoSelectTeams() {
    if (!staff.length) return showToast("Add participants first");
    if (!validTeamList) return showToast("Restore the 48-team list first");
    const pools = generateDrawPools(staff.length, state.teams);
    updateState({
      staff: staff.map((entry, staffIndex) => ({
        ...entry,
        tier1TeamId: pools.tier1Pool[staffIndex] || "",
        tier2TeamId: pools.tier2Pool[staffIndex] || "",
      })),
      settings: { ...state.settings, drawPools: null, liveDrawIndex: 0 },
    });
    showToast("Teams auto-selected for all participants");
  }

  function resetLiveDraw() {
    updateState({
      staff: staff.map((entry) => ({ ...entry, tier1TeamId: "", tier2TeamId: "" })),
      settings: { ...state.settings, drawPools: null, liveDrawIndex: 0 },
    });
    showToast("Live draw reset");
  }

  if (!person) return <EmptyPanel title="No participants yet" body="Add participants in Manager before starting the draw." />;

  return (
    <section className="min-h-[72vh] rounded-xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(244,248,68,0.14),transparent_28rem),linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5 md:p-10">
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {staff.map((entry, staffIndex) => {
          const active = entry.tier1TeamId && entry.tier2TeamId;
          return (
            <button key={entry.id} className={`badge shrink-0 ${staffIndex === index ? "border-lime/70 text-lime" : ""}`} onClick={() => updateState({ settings: { ...state.settings, liveDrawIndex: staffIndex } })}>
              {entry.name}: {active ? "Active" : "TBC"}
            </button>
          );
        })}
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-moon">Live company draw</p>
        <h2 className="mt-4 text-4xl font-black md:text-7xl">Next up: {person.name}</h2>
        <p className="mt-3 text-white/55">Draw {index + 1} of {staff.length}</p>

        <div className="mt-8 grid w-full gap-4 md:grid-cols-2">
          <RevealSlot label="Tier 1 Team" team={team1} onReveal={() => drawTier(1)} />
          <RevealSlot label="Tier 2 Team" team={team2} onReveal={() => drawTier(2)} />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn bg-white/10" onClick={() => move(-1)} disabled={index === 0}>Previous</button>
          <button className="btn btn-primary" onClick={() => move(1)} disabled={index === staff.length - 1}>Next</button>
          <button className="btn bg-white/10" onClick={autoSelectTeams}>Auto Select Teams</button>
          {allDrawn && <button className="btn btn-primary" onClick={() => setActiveView("Leaderboard")}>Leaderboard</button>}
          <button className="btn btn-danger" onClick={resetLiveDraw}>Reset Draw</button>
        </div>
      </div>
    </section>
  );
}

function RevealSlot({ label, team, onReveal }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 p-6">
      <p className="text-sm font-bold uppercase tracking-wide text-white/55">{label}</p>
      {team ? (
        <div className="reveal-card mt-4">
          <p className="text-7xl">{team.flag}</p>
          <p className="mt-3 text-3xl font-black">{team.country}</p>
          <p className="mt-2 text-sm text-white/55">FIFA rank {team.fifaRanking}</p>
        </div>
      ) : (
        <button className="btn btn-primary mt-8 w-full" onClick={onReveal}>Draw {label}</button>
      )}
    </div>
  );
}

function LeaderboardHub({ state, leaderboard, canEdit, unlockCurrentView, showToast }) {
  const alivePeople = leaderboard.filter((row) => row.status === "Active" || row.status === "Partially Active");
  const aliveTeams = state.teams.filter((team) => team.status !== "Knocked out");

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tournament stage" value={state.settings.currentStage} tone="text-gold" />
        <StatCard label="People still alive" value={alivePeople.length} />
        <StatCard label="Teams still alive" value={aliveTeams.length} />
        <StatCard label="Participants" value={state.staff.length} />
      </section>

      {!canEdit && <EditUnlockPanel label="leaderboard editing" onUnlock={unlockCurrentView} showToast={showToast} />}

      <section className="panel p-5">
        <h2 className="text-xl font-black">Leaderboard</h2>
        <LeaderboardTable leaderboard={leaderboard} />
      </section>
    </div>
  );
}

function BracketTab({ state, updateState, showToast, canEdit, unlockCurrentView }) {
  return (
    <div className="space-y-5">
      {!canEdit && <EditUnlockPanel label="bracket editing" onUnlock={unlockCurrentView} showToast={showToast} />}
      <GroupStage
        teams={state.teams}
        standings={state.groupStandings}
        onChange={(groupStandings) => updateState({ groupStandings })}
        showToast={showToast}
        canEdit={canEdit}
      />
      <Bracket
        rounds={state.bracket}
        thirdPlaceMatch={state.bracketThirdPlace}
        teams={state.teams}
        standings={state.groupStandings}
        canEdit={canEdit}
        onChange={(bracket) => updateState({ bracket })}
        onThirdPlaceChange={(bracketThirdPlace) => updateState({ bracketThirdPlace })}
      />
    </div>
  );
}

function GroupStage({ teams, standings, onChange, showToast, canEdit }) {
  const [pasteText, setPasteText] = useState("");
  const standingsByTeam = new Map(standings.map((standing) => [standing.teamId, standing]));
  const groups = [...new Set(teams.map((team) => team.group).filter(Boolean))].sort();

  function updateStanding(teamId, field, value) {
    const numericFields = ["position", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points"];
    onChange(
      standings.map((standing) =>
        standing.teamId === teamId ? { ...standing, [field]: numericFields.includes(field) ? Number(value) : value } : standing
      )
    );
  }

  function openFifaStandings() {
    window.location.href = FIFA_STANDINGS_URL;
  }

  function applyPastedStandings() {
    const result = parsePastedStandings(pasteText, teams, standings);
    if (!result.updatedCount) {
      showToast("No matching team rows found. Paste rows like: Mexico 3 2 1 0 5 2 7");
      return;
    }
    onChange(result.nextStandings);
    showToast(`${result.updatedCount} group rows updated`);
  }

  return (
    <section className="space-y-5">
      <section className="paste-panel">
        <div>
          <h3>Paste FIFA Standings Update</h3>
          <p>
            Paste directly from FIFA’s group tables, including headings. The app also accepts compact rows such as <span>Mexico 3 2 1 0 5 2 7</span>.
          </p>
        </div>
        {canEdit && (
          <textarea
            className="field min-h-36"
            placeholder={"Group A\nMexico 3 2 1 0 5 2 7\nSouth Korea 3 1 1 1 4 4 4"}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
          />
        )}
        <div className="flex flex-wrap gap-3">
          <button className="btn bg-white/10" onClick={openFifaStandings}>Open FIFA Standings</button>
          {canEdit && <button className="btn btn-primary" onClick={applyPastedStandings}>Apply Pasted Standings</button>}
          {canEdit && <button className="btn bg-white/10" onClick={() => setPasteText("")}>Clear Paste Box</button>}
        </div>
      </section>

      <div className="group-grid">
        {groups.map((group) => (
          <GroupCard key={group} group={group} teams={teams.filter((team) => team.group === group)} standingsByTeam={standingsByTeam} onUpdate={updateStanding} canEdit={canEdit} />
        ))}
      </div>
    </section>
  );
}

function parsePastedStandings(text, teams, standings) {
  const teamAliases = buildTeamAliases(teams);
  const nextByTeam = new Map(standings.map((standing) => [standing.teamId, { ...standing }]));
  const groupPositions = new Map();
  let currentGroup = "";
  let updatedCount = 0;
  const updatedTeams = new Set();

  function applyStanding(team, group, position, numbers, includesGoalDifference = false) {
    const previous = nextByTeam.get(team.id) || { teamId: team.id, group };
    nextByTeam.set(team.id, {
      ...previous,
      group,
      position,
      played: numbers[0],
      won: numbers[1],
      drawn: numbers[2],
      lost: numbers[3],
      goalsFor: numbers[4],
      goalsAgainst: numbers[5],
      points: includesGoalDifference ? numbers[7] : numbers[6],
    });
    if (!updatedTeams.has(team.id)) {
      updatedTeams.add(team.id);
      updatedCount += 1;
    }
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  lines.forEach((line) => {
    const groupMatch = line.match(/^group\s+([a-l])$/i);
    if (groupMatch) {
      currentGroup = groupMatch[1].toUpperCase();
      groupPositions.set(currentGroup, 0);
      return;
    }

    const normalisedLine = normaliseText(line);
    const match = findTeamAlias(normalisedLine, teamAliases);
    if (!match) return;

    const team = match.team;
    const countryIndex = line.toLowerCase().indexOf(team.country.toLowerCase());
    const statsText = countryIndex >= 0 ? line.slice(countryIndex + team.country.length) : line;
    const numbers = (statsText.match(/-?\d+/g) || []).map(Number);
    if (numbers.length < 7) return;

    const group = currentGroup || team.group || "";
    const nextPosition = (groupPositions.get(group) || 0) + 1;
    groupPositions.set(group, nextPosition);
    const lineStartsWithRank = /^\d+\s+/.test(line);
    const offset = lineStartsWithRank ? 1 : 0;
    const includesGoalDifference = numbers.slice(offset).length >= 8;
    applyStanding(team, group, lineStartsWithRank ? numbers[0] : nextPosition, numbers.slice(offset), includesGoalDifference);
  });

  currentGroup = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const groupMatch = line.match(/^group\s+([a-l])$/i);
    if (groupMatch) {
      currentGroup = groupMatch[1].toUpperCase();
      continue;
    }
    if (!/^\d+$/.test(line)) continue;
    const rank = Number(line);
    if (rank < 1 || rank > 4) continue;

    const teamLine = lines[index + 1];
    const match = teamLine ? findTeamAlias(normaliseText(teamLine), teamAliases, true) : null;
    if (!match) continue;

    const numbers = [];
    let cursor = index + 2;
    while (cursor < lines.length && numbers.length < 8) {
      const value = lines[cursor];
      if (/^group\s+[a-l]$/i.test(value)) break;
      if (/^-?\d+(?:\s+-?\d+)*$/.test(value)) numbers.push(...value.match(/-?\d+/g).map(Number));
      cursor += 1;
    }
    if (numbers.length < 8) continue;

    applyStanding(match.team, currentGroup || match.team.group || "", rank, numbers, true);
    index = cursor - 1;
  }

  return {
    nextStandings: standings.map((standing) => nextByTeam.get(standing.teamId) || standing),
    updatedCount,
  };
}

function buildTeamAliases(teams) {
  const extraAliases = {
    Mexico: ["MEX"],
    "South Africa": ["RSA"],
    "South Korea": ["KOR"],
    "Czech Republic": ["Czechia", "CZE"],
    Canada: ["CAN"],
    Switzerland: ["SUI"],
    Qatar: ["QAT"],
    "Bosnia & Herzegovina": ["Bosnia and Herzegovina", "BIH"],
    Brazil: ["BRA"],
    Morocco: ["MAR"],
    Scotland: ["SCO"],
    Haiti: ["HAI"],
    USA: ["United States", "United States of America", "USA"],
    Paraguay: ["PAR"],
    Australia: ["AUS"],
    Turkiye: ["Türkiye", "Turkey", "TUR"],
    Germany: ["GER"],
    Ecuador: ["ECU"],
    "Ivory Coast": ["Cote d Ivoire", "Côte d’Ivoire", "CIV"],
    Curacao: ["Curaçao", "CUW"],
    Netherlands: ["NED"],
    Japan: ["JPN"],
    Tunisia: ["TUN"],
    Sweden: ["SWE"],
    Belgium: ["BEL"],
    Iran: ["IRN"],
    Egypt: ["EGY"],
    "New Zealand": ["NZL"],
    Spain: ["ESP"],
    Uruguay: ["URU"],
    "Saudi Arabia": ["KSA"],
    "Cape Verde": ["CPV"],
    France: ["FRA"],
    Senegal: ["SEN"],
    Norway: ["NOR"],
    Iraq: ["IRQ"],
    Argentina: ["ARG"],
    Algeria: ["ALG"],
    Austria: ["AUT"],
    Jordan: ["JOR"],
    Portugal: ["POR"],
    Colombia: ["COL"],
    Uzbekistan: ["UZB"],
    "DR Congo": ["Congo DR", "Congo Democratic Republic", "COD"],
    England: ["ENG"],
    Croatia: ["CRO"],
    Ghana: ["GHA"],
    Panama: ["PAN"],
  };

  return teams.flatMap((team) => {
    const names = [team.country, team.country.replace("&", "and"), ...(extraAliases[team.country] || [])];
    return [...new Set(names)].map((name) => ({
      team,
      normalised: normaliseText(name),
    }));
  });
}

function findTeamAlias(normalisedLine, teamAliases, exact = false) {
  return teamAliases
    .filter((alias) => (exact ? normalisedLine === alias.normalised : normalisedLine.includes(alias.normalised)))
    .sort((a, b) => b.normalised.length - a.normalised.length)[0];
}

function normaliseText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function GroupCard({ group, teams, standingsByTeam, onUpdate, canEdit }) {
  const sortedTeams = [...teams].sort((a, b) => {
    const aStanding = standingsByTeam.get(a.id);
    const bStanding = standingsByTeam.get(b.id);
    return (aStanding?.position || 99) - (bStanding?.position || 99) || a.country.localeCompare(b.country);
  });

  return (
    <section className="group-card">
      <div className="flex items-center justify-between gap-3">
        <h3>Group {group}</h3>
        <span className="badge">{sortedTeams.length} teams</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="group-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team, index) => {
              const standing = standingsByTeam.get(team.id) || {};
              return (
                <tr key={team.id}>
                  <td><NumberField value={standing.position || index + 1} onChange={(value) => onUpdate(team.id, "position", value)} disabled={!canEdit} /></td>
                  <td className="group-team-name">{team.flag} {team.country}</td>
                  <td><NumberField value={standing.played || 0} onChange={(value) => onUpdate(team.id, "played", value)} disabled={!canEdit} /></td>
                  <td><NumberField value={standing.won || 0} onChange={(value) => onUpdate(team.id, "won", value)} disabled={!canEdit} /></td>
                  <td><NumberField value={standing.drawn || 0} onChange={(value) => onUpdate(team.id, "drawn", value)} disabled={!canEdit} /></td>
                  <td><NumberField value={standing.lost || 0} onChange={(value) => onUpdate(team.id, "lost", value)} disabled={!canEdit} /></td>
                  <td><NumberField value={standing.goalsFor || 0} onChange={(value) => onUpdate(team.id, "goalsFor", value)} disabled={!canEdit} /></td>
                  <td><NumberField value={standing.goalsAgainst || 0} onChange={(value) => onUpdate(team.id, "goalsAgainst", value)} disabled={!canEdit} /></td>
                  <td><NumberField value={standing.points || 0} onChange={(value) => onUpdate(team.id, "points", value)} strong disabled={!canEdit} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NumberField({ value, onChange, strong = false, disabled = false }) {
  return (
    <input
      className={`group-number ${strong ? "group-number-strong" : ""}`}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function LeaderboardTable({ leaderboard, managerMode = false, onUpdateStaff, onDeleteStaff }) {
  const [showPointsInfo, setShowPointsInfo] = useState(false);

  return (
    <div className="table-wrap mt-4">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Staff member</th>
            <th>Tier 1 team</th>
            <th>Tier 2 team</th>
            <th>Team statuses</th>
            <th>
              <span className="info-header">
                Total points
                <span className={`info-popover-wrap ${showPointsInfo ? "is-open" : ""}`}>
                  <button
                    className="info-button"
                    type="button"
                    aria-label="How total points are calculated"
                    aria-expanded={showPointsInfo}
                    onClick={() => setShowPointsInfo((isOpen) => !isOpen)}
                    onBlur={() => window.setTimeout(() => setShowPointsInfo(false), 120)}
                  >
                    i
                  </button>
                  <span className="info-popover" role="tooltip">
                    Total points include both assigned teams’ group-stage points, plus knockout progress: Round of 32 5, Round of 16 10, Quarter-final 20, Semi-final 35, Finalist 50, Champion 100. Tier 2 bonus: +10 for knockouts, +20 for quarter-final or better.
                  </span>
                </span>
              </span>
            </th>
            <th>Alive status</th>
            {managerMode && <th></th>}
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td>
                {managerMode ? (
                  <input className="field" value={row.name} onChange={(event) => onUpdateStaff(row.id, "name", event.target.value)} />
                ) : (
                  <span className="font-bold">{row.name}</span>
                )}
              </td>
              <td>{row.team1 ? `${row.team1.flag} ${row.team1.country}` : "TBC"}</td>
              <td>{row.team2 ? `${row.team2.flag} ${row.team2.country}` : "TBC"}</td>
              <td>{row.team1?.status || "TBC"} / {row.team2?.status || "TBC"}</td>
              <td className="text-lg font-black text-lime">{row.points}</td>
              <td><span className="badge">{calculatePersonStatus(row, [row.team1, row.team2].filter(Boolean))}</span></td>
              {managerMode && <td><button className="btn btn-danger" onClick={() => onDeleteStaff(row.id)}>Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const round32Placeholders = [
  ["1E", "3ABCDF"],
  ["1I", "3CDFGH"],
  ["2A", "2B"],
  ["1F", "2C"],
  ["2K", "2L"],
  ["1H", "2J"],
  ["1D", "3BEFIJ"],
  ["1G", "3AEHIJ"],
  ["1C", "2F"],
  ["2E", "2I"],
  ["1A", "3CEFHI"],
  ["1L", "3EHLIK"],
  ["1J", "2H"],
  ["2D", "2G"],
  ["1B", "3EFGIJ"],
  ["1K", "3DEIJL"],
];

const matchNumberStart = [73, 89, 97, 101, 104];

function Bracket({ rounds, thirdPlaceMatch, teams, standings, canEdit, onChange, onThirdPlaceChange }) {
  const bracketRounds = rounds?.length ? rounds : createDefaultBracket();
  const round32 = bracketRounds[0]?.matches || [];
  const round16 = bracketRounds[1]?.matches || [];
  const quarters = bracketRounds[2]?.matches || [];
  const semis = bracketRounds[3]?.matches || [];
  const final = bracketRounds[4]?.matches?.[0] || createDefaultBracket()[4].matches[0];
  const thirdPlace = thirdPlaceMatch || createDefaultThirdPlaceMatch();

  function updateMatch(roundIndex, matchIndex, field, value) {
    if (!canEdit) return;
    const next = cascadeBracketWinner(
      bracketRounds.map((round, rIndex) => ({
      ...round,
      matches: round.matches.map((match, mIndex) => (rIndex === roundIndex && mIndex === matchIndex ? { ...match, [field]: value } : match)),
      })),
      roundIndex,
      matchIndex,
      field,
      value
    );
    onChange(next);
    if (field === "winnerId" && roundIndex === 3) {
      const updatedSemi = next[roundIndex]?.matches?.[matchIndex];
      const loserId = [updatedSemi?.teamAId, updatedSemi?.teamBId].find((teamId) => teamId && teamId !== value) || "";
      const updatedThirdPlace = { ...thirdPlace, [matchIndex === 0 ? "teamAId" : "teamBId"]: loserId };
      if (updatedThirdPlace.winnerId && updatedThirdPlace.winnerId !== updatedThirdPlace.teamAId && updatedThirdPlace.winnerId !== updatedThirdPlace.teamBId) {
        updatedThirdPlace.winnerId = "";
      }
      onThirdPlaceChange(updatedThirdPlace);
    }
  }

  function updateThirdPlace(field, value) {
    if (!canEdit) return;
    onThirdPlaceChange({ ...thirdPlace, [field]: value });
  }

  function autoFillKnockout() {
    if (!canEdit) return;
    onChange(autoFillRoundOf32(bracketRounds, teams, standings));
  }

  return (
    <section className="space-y-5">
      <div className="panel p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-moon">{canEdit ? "Editable knockout route" : "View-only knockout route"}</p>
            <h2 className="mt-1 text-3xl font-black">Tournament Battle Bracket</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              {canEdit
                ? "Update each knockout slot as the World Cup progresses. The layout mirrors the official FIFA bracket rhythm: two outside Round of 32 paths feeding toward the central final."
                : "Follow the knockout route as it progresses. Editing is locked for staff viewing."}
            </p>
          </div>
          {canEdit && <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={autoFillKnockout}>Auto Fill Knockout From Groups</button>
            <button
              className="btn bg-white/10"
              onClick={() => {
                onChange(createDefaultBracket());
                onThirdPlaceChange(createDefaultThirdPlaceMatch());
              }}
            >
              Reset Bracket
            </button>
          </div>}
        </div>
      </div>

      <div className="bracket-shell">
        <div className="bracket-board" aria-label="Editable knockout bracket">
          <div className="bracket-side">
            <BracketColumn title="Round of 32" roundIndex={0} matches={round32.slice(0, 8)} startIndex={0} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
            <BracketColumn title="Round of 16" roundIndex={1} matches={round16.slice(0, 4)} startIndex={0} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
            <BracketColumn title="Quarter-final" roundIndex={2} matches={quarters.slice(0, 2)} startIndex={0} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
            <BracketColumn title="Semi-final" roundIndex={3} matches={semis.slice(0, 1)} startIndex={0} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
          </div>

          <div className="bracket-center">
            <BracketMatch
              title="Final"
              match={final}
              matchNumber={104}
              teams={teams}
              roundIndex={4}
              matchIndex={0}
              placeholderA="W101"
              placeholderB="W102"
              onUpdate={updateMatch}
              canEdit={canEdit}
              featured
            />
            <BracketMatch
              title="Play-off for third place"
              match={thirdPlace}
              matchNumber={103}
              teams={teams}
              placeholderA="RU101"
              placeholderB="RU102"
              onUpdate={(_, __, field, value) => updateThirdPlace(field, value)}
              canEdit={canEdit}
            />
          </div>

          <div className="bracket-side bracket-side-right">
            <BracketColumn title="Semi-final" roundIndex={3} matches={semis.slice(1, 2)} startIndex={1} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
            <BracketColumn title="Quarter-final" roundIndex={2} matches={quarters.slice(2, 4)} startIndex={2} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
            <BracketColumn title="Round of 16" roundIndex={1} matches={round16.slice(4, 8)} startIndex={4} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
            <BracketColumn title="Round of 32" roundIndex={0} matches={round32.slice(8, 16)} startIndex={8} teams={teams} canEdit={canEdit} onUpdate={updateMatch} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BracketColumn({ title, roundIndex, matches, startIndex, teams, canEdit, onUpdate }) {
  return (
    <div className={`bracket-column bracket-round-${roundIndex}`}>
      <h3>{title}</h3>
      <div className="bracket-column-stack">
        {matches.map((match, localIndex) => {
          const matchIndex = startIndex + localIndex;
          return (
            <BracketMatch
              key={match.id}
              match={match}
              matchNumber={matchNumberStart[roundIndex] + matchIndex}
              roundIndex={roundIndex}
              matchIndex={matchIndex}
              teams={teams}
              placeholderA={getBracketPlaceholder(roundIndex, matchIndex, 0)}
              placeholderB={getBracketPlaceholder(roundIndex, matchIndex, 1)}
              canEdit={canEdit}
              onUpdate={onUpdate}
            />
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({ title, match, matchNumber, roundIndex = 0, matchIndex = 0, teams, placeholderA, placeholderB, canEdit, onUpdate, featured = false }) {
  return (
    <div className={`bracket-match ${featured ? "bracket-match-featured" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          {title && <p className="text-sm font-black text-lime">{title}</p>}
          <p className="text-xs font-black uppercase tracking-wide text-white/45">M{matchNumber}</p>
        </div>
        <input
          className="bracket-kickoff"
          value={match.kickoff || ""}
          placeholder="Kickoff TBC"
          disabled={!canEdit}
          onChange={(event) => onUpdate(roundIndex, matchIndex, "kickoff", event.target.value)}
          aria-label={`Match ${matchNumber} kickoff`}
        />
      </div>
      <BracketSelect value={match.teamAId} teams={teams} placeholder={placeholderA} disabled={!canEdit} onChange={(value) => onUpdate(roundIndex, matchIndex, "teamAId", value)} />
      <BracketSelect value={match.teamBId} teams={teams} placeholder={placeholderB} disabled={!canEdit} onChange={(value) => onUpdate(roundIndex, matchIndex, "teamBId", value)} />
      <div className="mt-2 border-t border-white/10 pt-2">
        <BracketSelect value={match.winnerId} teams={teams} placeholder="Winner" winner disabled={!canEdit} onChange={(value) => onUpdate(roundIndex, matchIndex, "winnerId", value)} />
      </div>
    </div>
  );
}

function BracketSelect({ value, teams, placeholder, winner = false, disabled = false, onChange }) {
  if (disabled) {
    const team = getTeam(value, teams);
    return <div className={`bracket-slot-static ${winner ? "bracket-slot-winner" : ""}`}>{team ? `${team.flag} ${team.country}` : placeholder || "TBC"}</div>;
  }

  return (
    <select className={`bracket-slot ${winner ? "bracket-slot-winner" : ""}`} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder || "TBC"}</option>
      {teams.map((option) => <option value={option.id} key={option.id}>{option.flag} {option.country}</option>)}
    </select>
  );
}

function autoFillRoundOf32(rounds, teams, standings) {
  const usedThirdPlaceTeams = new Set();
  return rounds.map((round, roundIndex) => {
    if (roundIndex !== 0) {
      return {
        ...round,
        matches: round.matches.map((match) => ({ ...match, teamAId: "", teamBId: "", winnerId: "" })),
      };
    }
    return {
      ...round,
      matches: round.matches.map((match, matchIndex) => ({
        ...match,
        teamAId: resolveKnockoutPlaceholder(round32Placeholders[matchIndex]?.[0], teams, standings, usedThirdPlaceTeams),
        teamBId: resolveKnockoutPlaceholder(round32Placeholders[matchIndex]?.[1], teams, standings, usedThirdPlaceTeams),
        winnerId: "",
      })),
    };
  });
}

function resolveKnockoutPlaceholder(placeholder = "", teams, standings, usedThirdPlaceTeams) {
  const position = Number(placeholder[0]);
  const groups = placeholder.slice(1).split("");
  if (!position || !groups.length) return "";
  const standingRows = standings
    .map((standing) => ({
      ...standing,
      team: teams.find((team) => team.id === standing.teamId),
      goalDifference: Number(standing.goalsFor || 0) - Number(standing.goalsAgainst || 0),
    }))
    .filter((standing) => standing.team && groups.includes(standing.group));

  if (position === 3) {
    const thirdPlaceTeam = standingRows
      .filter((standing) => Number(standing.position) === 3 && !usedThirdPlaceTeams.has(standing.teamId))
      .sort(sortStandingsForQualification)[0];
    if (!thirdPlaceTeam) return "";
    usedThirdPlaceTeams.add(thirdPlaceTeam.teamId);
    return thirdPlaceTeam.teamId;
  }

  return standingRows.find((standing) => Number(standing.position) === position)?.teamId || "";
}

function sortStandingsForQualification(a, b) {
  return (
    Number(b.points || 0) - Number(a.points || 0) ||
    Number(b.goalDifference || 0) - Number(a.goalDifference || 0) ||
    Number(b.goalsFor || 0) - Number(a.goalsFor || 0) ||
    a.team.country.localeCompare(b.team.country)
  );
}

function cascadeBracketWinner(rounds, roundIndex, matchIndex, field, value) {
  if (field !== "winnerId" || roundIndex >= 4) return rounds;
  const next = rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match })) }));
  const nextRoundIndex = roundIndex + 1;
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextField = matchIndex % 2 === 0 ? "teamAId" : "teamBId";
  const nextMatch = next[nextRoundIndex]?.matches?.[nextMatchIndex];
  if (nextMatch) {
    nextMatch[nextField] = value;
    if (nextMatch.winnerId && nextMatch.winnerId !== nextMatch.teamAId && nextMatch.winnerId !== nextMatch.teamBId) {
      nextMatch.winnerId = "";
    }
  }
  return next;
}

function getBracketPlaceholder(roundIndex, matchIndex, slotIndex) {
  if (roundIndex === 0) return round32Placeholders[matchIndex]?.[slotIndex] || "TBC";
  const previousStart = matchNumberStart[roundIndex - 1];
  return `W${previousStart + matchIndex * 2 + slotIndex}`;
}

function EmptyPanel({ title, body }) {
  return (
    <section className="panel p-8 text-center">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-2 text-white/60">{body}</p>
    </section>
  );
}

export default App;
