import type { Team } from '../types';

/**
 * A fictional league so demos carry no third-party trademarks.
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

export const TEAM_BY_CODE: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.code, t]));
