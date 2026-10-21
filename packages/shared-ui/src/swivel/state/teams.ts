/** Team and autopilot preferences shared by the setup and Your teams screens. */
import {
  ALL_TEAMS,
  SPORTS,
  sportOfTeam,
  type GameInfo,
  type Loyalty,
  type Team,
  type TeamPrefs,
} from '@swivel/director';

/** Your teams grid width. */
export const TEAM_COLS = 4;

/** How loyal the autopilot is to your teams. */
export const LOYALTIES: Array<{ id: Loyalty; label: string; detail: string }> = [
  { id: 'team-first', label: 'My teams first', detail: 'Leave only for breaks or big drama' },
  { id: 'balanced', label: 'Balanced', detail: 'Your teams get a head start' },
  { id: 'drama', label: 'Best game on', detail: 'Always chase the tightest game' },
];

/** Tonight's teams, in league order (all 16 basketball teams on a basketball night). */
export function tonightsTeams(games: GameInfo[]): Team[] {
  const playing = new Set(games.flatMap((g) => [g.home.code, g.away.code]));
  return ALL_TEAMS.filter((t) => playing.has(t.code));
}

export function teamRows(teams: Team[]): number {
  return Math.ceil(teams.length / TEAM_COLS);
}

/** Focus grid: team rows, then loyalty + multiview, then done + forget learning. */
export function teamsGrid(teams: Team[]): number[] {
  const rows = Array.from({ length: teamRows(teams) }, (_, r) => Math.min(TEAM_COLS, teams.length - r * TEAM_COLS));
  return [...rows, 4, 2];
}

/** "Football", from the team's league. */
export function sportName(code: string): string {
  return SPORTS[sportOfTeam(code) ?? 'nba'].name;
}

export function cycleTeam(prefs: TeamPrefs, code: string): TeamPrefs {
  const fav = prefs.favorites.includes(code);
  const like = prefs.likes.includes(code);
  const favorites = prefs.favorites.filter((c) => c !== code);
  const likes = prefs.likes.filter((c) => c !== code);
  if (!fav && !like) favorites.push(code);
  else if (fav) likes.push(code);
  return { ...prefs, favorites, likes };
}
