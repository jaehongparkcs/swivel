/**
 * Core types for the Swivel director.
 *
 * Time model: every timestamp is milliseconds on a single "slate clock" (wall time
 * for a live slate, or replay time for a simulated one). Feed events carry the time
 * the data provider published them. Each channel's video lags the feed by `delayMs`,
 * so the director knows about a timeout before the viewer's stream shows it.
 */

export type Side = 'home' | 'away';

/** Sports Swivel can direct. Each one plugs its rules in through a `Sport` (see sports/). */
export type SportId = 'nba' | 'nfl' | 'mlb';

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
  | 'tipoff' // game start (tip-off, kickoff, first pitch)
  | 'score'
  | 'miss'
  | 'rebound'
  | 'turnover'
  | 'foul'
  | 'freethrow'
  | 'play' // any other live action (a football play, a plate appearance)
  | 'kickoff' // football: kickoff after a score or to start a half
  | 'timeout' // team timeout (full) -> commercial break
  | 'mandatory_timeout' // league-mandated media timeout -> commercial break
  | 'review' // replay review or challenge: stoppage, usually no commercial
  | 'two_minute_warning' // football: commercial at 2:00 of the 2nd and 4th quarters
  | 'pitching_change' // baseball: mid-inning commercial
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
  /** Basketball and football: 1-4 regulation, 5+ overtime. Baseball: half-inning, 1 = top of the 1st, 2 = bottom of the 1st. */
  period: number;
  /** Game clock (seconds remaining in period) at this event. Always 0 in baseball. */
  clock: number;
  /** Whether the game clock is running after this event. */
  clockRunning: boolean;
  homeScore: number;
  awayScore: number;
  team?: Side;
  points?: number;
  text: string;
  /** Baseball: outs in the half-inning after this event. */
  outs?: number;
  /** Baseball: runners on base after this event, bitmask (1 = first, 2 = second, 4 = third). */
  bases?: number;
  /** Football: team with the ball after this event. */
  possession?: Side;
  /** Football: ball position, yards from the offense's own goal line (80 = the red zone). */
  fieldPos?: number;
}

export type Phase = 'pregame' | 'live' | 'break' | 'final';
export type BreakKind =
  | 'timeout'
  | 'mandatory' // media / TV timeout
  | 'quarter'
  | 'halftime'
  | 'overtime'
  | 'review'
  | 'twominute' // football two-minute warning
  | 'inning' // baseball: between half-innings
  | 'pitching'; // baseball: pitching change

export interface GameInfo {
  id: string;
  home: Team;
  away: Team;
  channel: ChannelRef;
  /** Scheduled start time, slate-clock ms. */
  scheduledStart: number;
  /** Defaults to basketball. */
  sport?: SportId;
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
  /** Baseball: outs and runners (bitmask). */
  outs?: number;
  bases?: number;
  /** Football: team with the ball, and yards from its own goal line. */
  possession?: Side;
  fieldPos?: number;
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
  /** Typical-duration estimate of ms left in an on-screen break (used only for soft decisions, never shown as a countdown). */
  breakRemainingMs?: number;
  /** How long the on-screen break has lasted so far. */
  breakElapsedMs?: number;
  /** The feed already shows play resumed; ms until the stream catches up. A real countdown, not an estimate. */
  resumeIncomingInMs?: number;
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
  | 'team-game'
  | 'break'
  | 'break-incoming'
  | 'mandatory-armed'
  | 'final'
  | 'pregame';

export type Layout = 'single' | 'split' | 'trio' | 'quad';

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
  | 'hold' // considered switching but stayed (shown sparingly)
  | 'skip' // viewer pressed fast-forward
  | 'learned'; // the taste learner picked up something new

export interface Decision {
  t: number;
  kind: DecisionKind;
  from?: string;
  to?: string;
  layout: Layout;
  title: string;
  detail: string;
  /** Catch-up line for the game we just switched to, generated from the play-by-play. */
  recap?: { label: string; text: string };
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
  /** What the taste learner has picked up from remote presses. */
  learned: { likes: string[]; dislikes: string[]; drama: number; signals: number };
}
