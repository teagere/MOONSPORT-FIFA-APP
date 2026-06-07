# Moonsport Road to the Final

Responsive internal React app for managing the Moonsport FIFA World Cup 2026 office sweepstake.

## Setup

```bash
npm install
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173`.

## Draw Rules

- FIFA World Cup 2026 has 48 teams.
- Tier 1 is the 20 highest FIFA-ranked teams that have officially qualified.
- Tier 2 is the remaining 28 qualified teams.
- Each staff member receives exactly one Tier 1 team and one Tier 2 team.
- Teams may be assigned to more than one staff member.

Pool generation:

- Tier 1: include every Tier 1 team twice, then randomly duplicate additional Tier 1 teams until the Tier 1 pool equals the number of staff.
- Tier 2: include every Tier 2 team once, then randomly duplicate additional Tier 2 teams until the Tier 2 pool equals the number of staff.
- The generated pools are shuffled before assignment.
- In Live Draw, each participant is revealed one at a time. Their status changes from TBC to Active once both teams are drawn.

## Scoring

- Total points include both assigned teams' group-stage table points.
- Knockout progress adds: Round of 32 = 5, Round of 16 = 10, Quarter-final = 20, Semi-final = 35, Finalist = 50, Champion = 100.
- Tier 2 bonus: +10 for reaching the knockouts and +20 for reaching the quarter-final or better.

## Important Data Note

The app is seeded with the 48-team FIFA World Cup 2026 list and FIFA ranking data used for the company draw. If teams are accidentally removed in the browser, opening the app with the current data version or pressing **Restore 48 Teams** in Teams restores the complete list.

Useful source checks:

- FIFA qualified teams page: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/world-cup-2026-who-has-qualified
- FIFA men’s ranking page: https://inside.fifa.com/en/fifa-world-ranking/men

## Features

- Manager: password-protected admin area. Password: `1111`.
- Manager tools for adding one participant, bulk uploading names, importing/exporting JSON, exporting assignments CSV, and resetting the live draw.
- Teams: 48 official qualified countries, ranking, tier, group, tournament status, Restore 48 Teams, Recalculate Tiers, Locked In, and Unlock.
- Draw Setup: simplified Tier 1 and Tier 2 confirmation view.
- Live Draw: presentation mode with participant TBC/Active strip and one-by-one team reveals.
- Leaderboard: public tournament hub with live standings, tournament stage, active teams, and participant status.
- Bracket: editable group-stage tables plus a FIFA-inspired knockout bracket with mirrored Round of 32 routes, central final, and third-place play-off.
- Standings update shortcut: the Bracket tab includes a paste box for copied FIFA standings rows. Use rows like `Mexico 3 2 1 0 5 2 7` for Team, Played, Won, Drawn, Lost, Goals For, Goals Against, Points.

## Storage

By default the app uses `localStorage`. Data is saved in the current browser only and belongs to the exact URL you use to open the app. Keep using one consistent address for the full tournament, preferably `http://127.0.0.1:5173/` from `Start Moonsport App.command`; switching between `localhost`, `127.0.0.1`, or different ports creates separate browser storage.

Use Manager > Data Backup > Download Backup before major updates, before shutting down, or before moving the sweepstake to another machine.

## Optional Supabase Cloud Sync

Supabase can be used as a shared cloud save file so staff and friends see the same live leaderboard from their own computers.

Create this table in Supabase SQL Editor:

```sql
create table public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

insert into public.app_state (id, data)
values ('main', '{}'::jsonb);

alter table public.app_state enable row level security;

create policy "Anyone can view app state"
on public.app_state
for select
to anon
using (true);

create policy "Anyone can update app state"
on public.app_state
for insert
to anon
with check (id = 'main');

create policy "Anyone can save app state"
on public.app_state
for update
to anon
using (id = 'main')
with check (id = 'main');
```

Then copy `.env.example` to `.env.local` and add your Supabase project URL and public anon key:

```bash
cp .env.example .env.local
```

Restart the dev server after changing `.env.local`. The header will show **Cloud live** when the app is connected. Without those values, the app stays in local save mode.

For a public production app, replace the open write policies with Supabase Auth or a protected server function before sharing the manager tools widely.
