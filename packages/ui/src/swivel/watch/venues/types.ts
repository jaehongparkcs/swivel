import type { GameInsight } from '@swivel/director';

/** What every venue drawing gets: the game, the box it fills (above the scorebug), and the frame time. */
export interface VenueProps {
  g: GameInsight;
  box: { width: number; height: number; margin: number };
  now: number;
  live: boolean;
}

/** Field lines and markings. */
export const LINE = 'rgba(242,244,247,0.75)';
