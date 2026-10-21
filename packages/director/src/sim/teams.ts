import type { SportId, Team } from '../types';

/**
 * Fictional leagues so demos carry no third-party trademarks. Basketball:
 * Real NBA schedules and feeds plug in through a LineupSource adapter.
 */
export const TEAMS: Team[] = [
  { code: 'ATX', city: 'Austin', name: 'Comets', color: '#F26B1D', alt: '#1B1F3B' },
  { code: 'BAL', city: 'Baltimore', name: 'Ironclads', color: '#5A6B7B', alt: '#E8C547' },
  { code: 'DEN', city: 'Denver', name: 'Summit', color: '#2F6FDB', alt: '#F2F2F2' },
  { code: 'HNL', city: 'Honolulu', name: 'Waves', color: '#00A6A6', alt: '#FFD166' },
  { code: 'KCS', city: 'Kansas City', name: 'Steam', color: '#D4A017', alt: '#2B2B2B' },
  { code: 'LVJ', city: 'Las Vegas', name: 'Jackpots', color: '#9B5DE5', alt: '#F15BB5' },
  { code: 'LOU', city: 'Louisville', name: 'Thoroughbreds', color: '#2E9E5B', alt: '#F4F1DE' },
  { code: 'NSH', city: 'Nashville', name: 'Strings', color: '#E84A8A', alt: '#1D1D1D' },
  { code: 'OMA', city: 'Omaha', name: 'Owls', color: '#8D99AE', alt: '#EF233C' },
  { code: 'PIT', city: 'Pittsburgh', name: 'Forge', color: '#F4A259', alt: '#232323' },
  { code: 'SDS', city: 'San Diego', name: 'Surf', color: '#3DCCC7', alt: '#22577A' },
  { code: 'SEA', city: 'Seattle', name: 'Evergreens', color: '#2D6A4F', alt: '#B7E4C7' },
  { code: 'STL', city: 'St. Louis', name: 'Archers', color: '#C1121F', alt: '#FDF0D5' },
  { code: 'VAN', city: 'Vancouver', name: 'Orcas', color: '#4CC9F0', alt: '#14213D' },
  { code: 'ABQ', city: 'Albuquerque', name: 'Roadrunners', color: '#E9C46A', alt: '#264653' },
  { code: 'TPA', city: 'Tampa', name: 'Mangroves', color: '#52B788', alt: '#081C15' },
];

/** Fictional football league. Codes never collide with the other leagues, so learned taste stays per team. */
export const NFL_TEAMS: Team[] = [
  { code: 'BOS', city: 'Boston', name: 'Lamplighters', color: '#1D3557', alt: '#F1C40F' },
  { code: 'CHI', city: 'Chicago', name: 'Gales', color: '#2B2D42', alt: '#8ECAE6' },
  { code: 'DAL', city: 'Dallas', name: 'Thunderheads', color: '#003F88', alt: '#FDC500' },
  { code: 'DET', city: 'Detroit', name: 'Foundry', color: '#5C677D', alt: '#E85D04' },
  { code: 'MIA', city: 'Miami', name: 'Barracudas', color: '#00B4D8', alt: '#FF6B6B' },
  { code: 'MIN', city: 'Minneapolis', name: 'Lumberjacks', color: '#386641', alt: '#F2E8CF' },
  { code: 'PHX', city: 'Phoenix', name: 'Scorpions', color: '#9D0208', alt: '#FFBA08' },
  { code: 'CLT', city: 'Charlotte', name: 'Copperheads', color: '#B5651D', alt: '#1B1B1B' },
  { code: 'SLC', city: 'Salt Lake', name: 'Peaks', color: '#457B9D', alt: '#F1FAEE' },
  { code: 'SAC', city: 'Sacramento', name: 'Prospectors', color: '#CA6702', alt: '#001219' },
  { code: 'RAL', city: 'Raleigh', name: 'Foxes', color: '#E76F51', alt: '#264653' },
  { code: 'BIR', city: 'Birmingham', name: 'Blacksmiths', color: '#343A40', alt: '#ADB5BD' },
  { code: 'MEM', city: 'Memphis', name: 'Riverboats', color: '#6A4C93', alt: '#FFCA3A' },
  { code: 'OKC', city: 'Oklahoma City', name: 'Twisters', color: '#3A86FF', alt: '#FFBE0B' },
  { code: 'ANC', city: 'Anchorage', name: 'Glaciers', color: '#A8DADC', alt: '#1D3557' },
  { code: 'CIN', city: 'Cincinnati', name: 'Sentinels', color: '#D00000', alt: '#FFBA08' },
];

/** Fictional baseball league. */
export const MLB_TEAMS: Team[] = [
  { code: 'POR', city: 'Portland', name: 'Rosebuds', color: '#C9184A', alt: '#FFF0F3' },
  { code: 'NOL', city: 'New Orleans', name: 'Krewe', color: '#5A189A', alt: '#FFD60A' },
  { code: 'IND', city: 'Indianapolis', name: 'Racers', color: '#0077B6', alt: '#F8F9FA' },
  { code: 'CMH', city: 'Columbus', name: 'Aviators', color: '#023E8A', alt: '#E63946' },
  { code: 'BUF', city: 'Buffalo', name: 'Blizzard', color: '#4361EE', alt: '#F1FAEE' },
  { code: 'RIC', city: 'Richmond', name: 'Rivermen', color: '#2D6A4F', alt: '#FFD166' },
  { code: 'ELP', city: 'El Paso', name: 'Sun Kings', color: '#F77F00', alt: '#003049' },
  { code: 'BOI', city: 'Boise', name: 'Spuds', color: '#8D5524', alt: '#F4E3B2' },
  { code: 'HSV', city: 'Huntsville', name: 'Orbiters', color: '#14213D', alt: '#FCA311' },
  { code: 'SAV', city: 'Savannah', name: 'Live Oaks', color: '#606C38', alt: '#FEFAE0' },
  { code: 'TUL', city: 'Tulsa', name: 'Gushers', color: '#283618', alt: '#DDA15E' },
  { code: 'MKE', city: 'Milwaukee', name: 'Anglers', color: '#0B3954', alt: '#BFD7EA' },
  { code: 'SPK', city: 'Spokane', name: 'Ospreys', color: '#3D405B', alt: '#F2CC8F' },
  { code: 'FRE', city: 'Fresno', name: 'Vintners', color: '#6D597A', alt: '#EAAC8B' },
  { code: 'HFD', city: 'Hartford', name: 'Charter Oaks', color: '#1B4332', alt: '#D8F3DC' },
  { code: 'LIT', city: 'Little Rock', name: 'Rockets', color: '#E5383B', alt: '#161A1D' },
];

export const TEAMS_BY_SPORT: Record<SportId, Team[]> = { nba: TEAMS, nfl: NFL_TEAMS, mlb: MLB_TEAMS };
export const ALL_TEAMS: Team[] = [...TEAMS, ...NFL_TEAMS, ...MLB_TEAMS];
export const TEAM_BY_CODE: Record<string, Team> = Object.fromEntries(ALL_TEAMS.map((t) => [t.code, t]));

const SPORT_BY_CODE: Record<string, SportId> = Object.fromEntries(
  (Object.keys(TEAMS_BY_SPORT) as SportId[]).flatMap((sport) => TEAMS_BY_SPORT[sport].map((t) => [t.code, sport])),
);

/** Which league a team plays in (team codes are unique across leagues). */
export function sportOfTeam(code: string): SportId | undefined {
  return SPORT_BY_CODE[code];
}
