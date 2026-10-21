import type { ComponentType } from 'react';
import type { SportId } from '@swivel/director';
import Ballpark from './Ballpark';
import Court from './Court';
import FootballField from './FootballField';
import type { VenueProps } from './types';

/** The venue each sport is drawn in. Adding a sport means adding its venue here (the type requires it). */
export const VENUES: Record<SportId, ComponentType<VenueProps>> = { nba: Court, nfl: FootballField, mlb: Ballpark };

export type { VenueProps } from './types';
