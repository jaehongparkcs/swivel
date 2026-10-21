import { NBA } from './sports/nba';
import type { Sport } from './sports/sport';
import type { FeedEvent, GameSnapshot } from './types';

const MANDATORY_WINDOWS = [420, 180]; // first dead ball under 7:00 and under 3:00
const RECENT_SCORING_KEEP = 16;

export function initialSnapshot(id: string, clock = 720): GameSnapshot {
  return {
    id,
    phase: 'pregame',
    period: 1,
    clock,
    clockRunning: false,
    homeScore: 0,
    awayScore: 0,
    mandatoryDone: 0,
    mandatoryArmed: false,
    recentScoring: [],
    lastEventAt: 0,
  };
}

function satisfiedWindows(clock: number): number {
  return MANDATORY_WINDOWS.filter((w) => clock < w).length;
}

/** Pure reducer: apply one feed event to a game snapshot. */
export function reduce(s: GameSnapshot, e: FeedEvent, sport: Sport = NBA): GameSnapshot {
  const next: GameSnapshot = {
    ...s,
    period: e.period,
    clock: e.clock,
    clockRunning: e.clockRunning,
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    lastEvent: e,
    lastEventAt: e.t,
  };
  if (e.outs !== undefined) next.outs = e.outs;
  if (e.bases !== undefined) next.bases = e.bases;
  if (e.possession !== undefined) next.possession = e.possession;
  if (e.fieldPos !== undefined) next.fieldPos = e.fieldPos;

  switch (e.type) {
    case 'tipoff':
    case 'period_start':
      next.phase = 'live';
      next.breakKind = undefined;
      next.breakStartedAt = undefined;
      if (e.type === 'period_start' || e.period !== s.period) next.mandatoryDone = 0;
      break;
    case 'timeout':
    case 'mandatory_timeout':
      next.phase = 'break';
      next.breakKind = e.type === 'timeout' ? 'timeout' : 'mandatory';
      next.breakStartedAt = e.t;
      // Any full timeout inside an open window satisfies that media timeout.
      next.mandatoryDone = Math.max(s.mandatoryDone, satisfiedWindows(e.clock));
      break;
    case 'review':
    case 'two_minute_warning':
    case 'pitching_change':
      next.phase = 'break';
      next.breakKind = e.type === 'review' ? 'review' : e.type === 'two_minute_warning' ? 'twominute' : 'pitching';
      next.breakStartedAt = e.t;
      break;
    case 'period_end':
      next.phase = 'break';
      next.breakKind = sport.breakForPeriodEnd(e);
      next.breakStartedAt = e.t;
      next.clockRunning = false;
      break;
    case 'game_end':
      next.phase = 'final';
      next.breakKind = undefined;
      next.clockRunning = false;
      break;
    default:
      // Any live-ball event means play has resumed.
      if (s.phase === 'break' || s.phase === 'pregame') {
        next.phase = 'live';
        next.breakKind = undefined;
        next.breakStartedAt = undefined;
      }
  }

  if (e.points && e.team && (e.type === 'score' || e.type === 'freethrow')) {
    next.recentScoring = [...s.recentScoring, [e.t, e.team, e.points] as [number, 'home' | 'away', number]].slice(
      -RECENT_SCORING_KEEP,
    );
  }

  next.mandatoryArmed =
    sport.mediaWindows &&
    next.phase === 'live' &&
    next.period <= 4 &&
    satisfiedWindows(next.clock) > next.mandatoryDone;
  return next;
}

/**
 * Append-only per-game event log with O(log n) snapshot lookup at any time.
 * The feed view is snapshotAt(now); the on-screen view is snapshotAt(now - channelDelay).
 */
export class GameTimeline {
  private events: FeedEvent[] = [];
  private snapshots: GameSnapshot[] = [];
  private readonly empty: GameSnapshot;

  constructor(
    readonly gameId: string,
    private readonly sport: Sport = NBA,
  ) {
    this.empty = initialSnapshot(gameId, sport.startClock);
  }

  push(e: FeedEvent): void {
    const last = this.events[this.events.length - 1];
    if (last && e.seq <= last.seq) return; // duplicate / stale delivery
    const ev = last && e.t < last.t ? { ...e, t: last.t } : e; // never go back in time
    const prev = this.snapshots[this.snapshots.length - 1] ?? this.empty;
    this.events.push(ev);
    this.snapshots.push(reduce(prev, ev, this.sport));
  }

  get size(): number {
    return this.events.length;
  }

  private indexAt(t: number): number {
    let lo = 0;
    let hi = this.events.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.events[mid].t <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  snapshotAt(t: number): GameSnapshot {
    const i = this.indexAt(t);
    return i < 0 ? this.empty : this.snapshots[i];
  }

  /** First event strictly after time t, if the feed has delivered it. */
  nextEventAfter(t: number): FeedEvent | undefined {
    const i = this.indexAt(t);
    return this.events[i + 1];
  }

  /** Events with t in (from, to]. */
  eventsBetween(from: number, to: number): FeedEvent[] {
    const a = this.indexAt(from);
    const b = this.indexAt(to);
    return this.events.slice(a + 1, b + 1);
  }

  /**
   * Live-interpolated game clock for a view at time t. When the next event is
   * already known (the feed runs ahead of the video), the clock is run backwards
   * from it so it ticks smoothly through dead balls; otherwise it extrapolates.
   */
  clockAt(t: number): number {
    const s = this.snapshotAt(t);
    if (s.phase !== 'live') return s.clock;
    const next = this.nextEventAfter(t);
    if (next && next.period === s.period && next.clock <= s.clock) {
      const runMs = (s.clock - next.clock) * 1000;
      const startRun = Math.max(s.lastEventAt, next.t - runMs);
      if (t <= startRun) return s.clock;
      return Math.max(next.clock, s.clock - (t - startRun) / 1000);
    }
    if (!s.clockRunning) return s.clock;
    return Math.max(0, s.clock - (t - s.lastEventAt) / 1000);
  }
}
