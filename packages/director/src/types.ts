/**
 * Core types for the Fastbreak director.
 *
 * Time model: every timestamp is milliseconds on a single "slate clock" (wall time
 * for a live slate, or replay time for a simulated one). Feed events carry the time
 * the data provider published them. Each channel's video lags the feed by `delayMs`,
 * so the director knows about a timeout before the viewer's stream shows it.
 */

export type Side = 'home' | 'away';

export interface Team {
  code: string; // 3-letter code, e.g. "ATX"
  city: string;
  name: string;
  color: string; // primary color, hex
  alt: string; // secondary color, hex
}

/** A channel in the viewer's live TV lineup (EPG entry) carrying a game. */
export interface ChannelRef {
  id: string;
  number: number;
  name: string;
  /** How far the channel's video lags the play-by-play feed. */
  delayMs: number;
}

export type FeedEventType =
  | 'tipoff'
  | 'score'
  | 'miss'
  | 'rebound'
  | 'turnover'
  | 'foul'
  | 'freethrow'
  | 'timeout' // team timeout (full) -> commercial break
  | 'mandatory_timeout' // league-mandated media timeout -> commercial break
  | 'review' // replay review: stoppage, usually no commercial
  | 'resume' // play resumes after a stoppage (inbound / ball in play)
  | 'period_end'
  | 'period_start'
  | 'game_end';

export interface FeedEvent {
  gameId: string;
  seq: number;
  /** Slate-clock ms at which the feed published this event. */
  t: number;
  type: FeedEventType;
  period: number; // 1-4 regulation, 5+ overtime
  /** Game clock (seconds remaining in period) at this event. */
  clock: number;
  /** Whether the game clock is running after this event. */
  clockRunning: boolean;
  homeScore: number;
  awayScore: number;
  team?: Side;
  points?: number;
  text: string;
}

export type Phase = 'pregame' | 'live' | 'break' | 'final';
export type BreakKind = 'timeout' | 'mandatory' | 'quarter' | 'halftime' | 'overtime' | 'review';

export interface GameInfo {
  id: string;
  home: Team;
  away: Team;
  channel: ChannelRef;
  /** Scheduled tip time, slate-clock ms. */
  scheduledStart: number;
}

/** Reduced state of one game as of some event (feed view or on-screen view). */
export interface GameSnapshot {
  id: string;
  phase: Phase;
  period: number;
  clock: number;
  clockRunning: boolean;
  homeScore: number;
  awayScore: number;
  breakKind?: BreakKind;
  /** Slate-clock ms when the current break began (in this view's timeline). */
  breakStartedAt?: number;
  /** Media-timeout windows already satisfied this period (0, 1 = the 7:00 window, 2 = both). */
  mandatoryDone: number;
  /** A mandatory media timeout is due at the next dead ball. */
  mandatoryArmed: boolean;
  /** Recent scoring for momentum, newest last: [slate ms, side, points]. */
  recentScoring: Array<[number, Side, number]>;
  lastEvent?: FeedEvent;
  lastEventAt: number;
}

/** Everything the director derives about a game at a moment in time. */
export interface GameInsight {
  info: GameInfo;
  /** What the viewer's stream is showing right now (feed delayed by channel lag). */
  screen: GameSnapshot;
  /** Latest feed state (ahead of the stream). */
  feed: GameSnapshot;
  /** Live-interpolated game clock on screen, seconds. */
  displayClock: number;
  homeWinProb: number;
  /** Leverage index: 1.0 ~= the opening tip; >2 close; >4 crunch time. */
  leverage: number;
  /** Probability the on-screen game goes to a break in the next ~45s of viewer time. */
  breakRisk: number;
  /** If the feed already shows a break the stream hasn't reached, ms until it appears on screen. */
  breakIncomingInMs?: number;
  /** Estimated ms until a current on-screen break ends. */
  breakRemainingMs?: number;
  /** Preference weight 0..1 from the viewer's teams. */
  preference: number;
  /** Final watch score used by the director (higher = more watchable now). */
  watchScore: number;
  tags: InsightTag[];
}

export type InsightTag =
  | 'crunch'
  | 'close'
  | 'overtime'
  | 'blowout'
  | 'run'
  | 'favorite'
  | 'break'
  | 'break-incoming'
  | 'mandatory-armed'
  | 'final'
  | 'pregame';

export type Layout = 'single' | 'split' | 'quad';

export type DecisionKind =
  | 'start'
  | 'break-hop' // primary went to break, moved elsewhere
  | 'return' // break over, came back
  | 'upgrade' // a clearly better game took over
  | 'final-hop' // primary game ended
  | 'multiview-on'
  | 'multiview-off'
  | 'tile-swap' // a multiview tile replaced
  | 'manual'
  | 'lock'
  | 'unlock'
  | 'hold'; // considered switching but stayed (shown sparingly)

export interface Decision {
  t: number;
  kind: DecisionKind;
  from?: string;
  to?: string;
  layout: Layout;
  title: string;
  detail: string;
}

export type Loyalty = 'team-first' | 'balanced' | 'drama';

export interface TeamPrefs {
  /** Team codes the viewer follows most closely. */
  favorites: string[];
  /** Team codes the viewer likes. */
  likes: string[];
  loyalty: Loyalty;
  multiview: boolean;
}

export interface DirectorConfig {
  /** Minimum ms on a game before an opportunistic (non-break) switch. */
  minDwellMs: number;
  /** Watch-score margin a challenger needs to take over (hysteresis). */
  upgradeMargin: number;
  /** Bias toward returning to the game we left for a break. */
  returnBias: number;
  /** Leverage threshold for "must-see" games that justify multiview. */
  mustSeeLeverage: number;
  /** Minimum ms between layout changes. */
  minLayoutMs: number;
  /** Don't switch into a game whose break will hit the screen within this window. */
  incomingBreakGuardMs: number;
  /** Ignore breaks shorter than this (e.g. replay reviews) unless an alternative is much better. */
  softBreakMs: number;
}

export interface DirectorView {
  t: number;
  layout: Layout;
  /** Game ids by tile position (stable across updates so tiles don't jump around). */
  slots: string[];
  /** Game whose audio is playing (always one of `slots`). */
  audio?: string;
  /** Games currently treated as must-see (crunch time, with hysteresis). */
  mustSee: string[];
  locked: boolean;
  /** Game we left for a break and intend to return to. */
  returnTo?: string;
  /** Where we'd go next if the primary hit a break now. */
  onDeck?: string;
  insights: GameInsight[];
  decisions: Decision[];
}
