import type { SportId } from '../src';

/** SPORTS=nba,nfl,mlb runs a script on a mixed night; unset means basketball only. */
export const SPORTS: SportId[] | undefined = process.env.SPORTS
  ? (process.env.SPORTS.split(',') as SportId[])
  : undefined;
