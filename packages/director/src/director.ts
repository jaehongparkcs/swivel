import { BREAK_EVENT_TYPES, breakHazard, breakRemainingMs, currentRun, isCommercial } from './breakModel';
import { BREAK_NAMES, durationLabel, matchup, situation, whyWatch } from './explain';
import { GameTimeline } from './gameState';
import { TasteLearner, type Lesson, type TasteSnapshot } from './learner';
import { buildRecap } from './recap';
import { homeWinProb, leverageIndex } from './winprob';
import type {
  Decision,
  DecisionKind,
  DirectorConfig,
  DirectorView,
  FeedEvent,
  GameInfo,
  GameInsight,
  InsightTag,
  Layout,
  Loyalty,
  TeamPrefs,
} from './types';

export const DEFAULT_CONFIG: DirectorConfig = {
  minDwellMs: 120_000,
  upgradeMargin: 0.8,
  returnBias: 0.6,
  mustSeeLeverage: 3,
  minLayoutMs: 45_000,
  incomingBreakGuardMs: 20_000,
  softBreakMs: 90_000,
};

export const DEFAULT_PREFS: TeamPrefs = { favorites: [], likes: [], loyalty: 'balanced', multiview: true };

const LOYALTY_WEIGHT: Record<Loyalty, number> = { 'team-first': 4, balanced: 1.5, drama: 0.3 };
const LAYOUT_FOR: Layout[] = ['single', 'single', 'split', 'trio', 'quad'];
/** A tile whose game cools off (no longer crunch time) leaves after this long. */
const COOL_OFF_MS = 30_000;
/** Minimum time between adding tiles / entering multiview. */
const GROW_MS = 10_000;
/** A must-see game stays must-see until its leverage falls below this. */
const MUST_SEE_EXIT_LEVERAGE = 1.8;
const MAX_DECISIONS = 60;

/** Score that makes a game worth watching right now, before preference. */
function dramaScore(leverage: number, tags: InsightTag[]): number {
  let s = Math.min(3.5, Math.log2(1 + leverage));
  if (tags.includes('run')) s += 0.3;
  if (tags.includes('overtime')) s += 0.3;
  return s;
}

export class Director {
  private readonly games = new Map<string, GameInfo>();
  private readonly timelines = new Map<string, GameTimeline>();
  private readonly config: DirectorConfig;
  private prefs: TeamPrefs;

  private layout: Layout = 'single';
  private slots: string[] = [];
  private audio?: string;
  private readonly mustSee = new Set<string>();
  private readonly coolingSince = new Map<string, number>();
  /** Tiles pulled for a commercial, so we can say "is back" when they return. */
  private readonly benched = new Set<string>();
  private locked = false;
  /**
   * The game the viewer was really watching before stoppages sent us elsewhere.
   * Hopping again from a fill-in game keeps the original anchor, so we never
   * cascade back through every game we passed through.
   */
  private anchor?: string;
  /** Set when the anchor came from tuning in, so the viewer was never actually on it. */
  private anchorFromStartup = false;
  private lastSwitchAt = -Infinity;
  private lastLayoutAt = -Infinity;
  private manualHoldUntil = -Infinity;
  private decisions: Decision[] = [];
  private readonly learner: TasteLearner;
  /** Stream time at which each game was last on screen. */
  private readonly lastSeen = new Map<string, number>();

  constructor(
    games: GameInfo[],
    prefs: TeamPrefs = DEFAULT_PREFS,
    config: Partial<DirectorConfig> = {},
    taste?: TasteSnapshot,
  ) {
    this.learner = new TasteLearner(taste);
    for (const g of games) {
      this.games.set(g.id, g);
      this.timelines.set(g.id, new GameTimeline(g.id));
    }
    this.prefs = prefs;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.learner.setPrior((code) => this.explicitAffinity(code));
  }

  // ---------------------------------------------------------------- inputs

  ingest(e: FeedEvent): void {
    this.timelines.get(e.gameId)?.push(e);
  }

  ingestAll(events: Iterable<FeedEvent>): void {
    for (const e of events) this.ingest(e);
  }

  setPrefs(prefs: TeamPrefs): void {
    this.prefs = prefs;
  }

  /** Explicit preference for a team: 1 for a favorite, 0.5 for a like. */
  private explicitAffinity(code: string): number {
    if (this.prefs.favorites.includes(code)) return 1;
    if (this.prefs.likes.includes(code)) return 0.5;
    return 0;
  }

  getPrefs(): TeamPrefs {
    return this.prefs;
  }

  toggleLock(t: number): void {
    this.locked = !this.locked;
    if (this.locked && this.audio) this.learn(t, this.learner.onHold(this.insight(this.audio, t)));
    const primary = this.audio && this.games.get(this.audio);
    this.log(t, this.locked ? 'lock' : 'unlock', {
      title: this.locked ? 'Autopilot paused' : 'Autopilot on',
      detail: this.locked
        ? `Staying on ${primary ? matchup(primary) : 'this game'} until you unlock.`
        : 'Swivel will hop on breaks and bring you to tight games.',
    });
  }

  isLocked(): boolean {
    return this.locked;
  }

  /** Viewer picked a game with the remote. */
  manualSelect(gameId: string, t: number): void {
    const info = this.games.get(gameId);
    if (!info) return;
    const from = this.audio ?? this.slots[0];
    const picked = this.insight(gameId, t);
    const left = from ? this.insight(from, t) : undefined;
    this.slots = [gameId];
    this.audio = gameId;
    this.layout = 'single';
    this.anchor = undefined;
    this.lastSwitchAt = t;
    this.lastLayoutAt = t;
    this.manualHoldUntil = t + this.config.minDwellMs * 2;
    this.log(t, 'manual', {
      from,
      to: gameId,
      title: `Watching ${matchup(info)}`,
      detail: 'Your pick. Autopilot still covers breaks.',
      recap: this.recapFor(gameId, t),
    });
    if (from !== gameId) this.learn(t, this.learner.onPick(picked, left));
  }

  /** Fast-forward: leave this game for the next best one, and learn from it. */
  skip(t: number): void {
    const cur = this.audio ?? this.slots[0];
    if (!cur) return;
    const current = this.insight(cur, t);
    const ranked = [...this.games.keys()]
      .filter((id) => id !== cur)
      .map((id) => this.insight(id, t))
      .filter((g) => this.eligible(g))
      .sort((a, b) => b.watchScore - a.watchScore);
    const to = ranked[0];
    if (!to) return;
    this.slots = [to.info.id];
    this.audio = to.info.id;
    this.layout = 'single';
    this.anchor = undefined;
    this.lastSwitchAt = t;
    this.lastLayoutAt = t;
    this.manualHoldUntil = t + this.config.minDwellMs;
    this.log(t, 'skip', {
      from: cur,
      to: to.info.id,
      title: `Skipped ${matchup(current.info)}`,
      detail: `Now: ${matchup(to.info)} · ${situation(to)}.`,
      recap: this.recapFor(to.info.id, t),
    });
    this.learn(t, this.learner.onSkip(current, to));
  }

  resetLearning(t: number): void {
    this.learner.reset();
    this.log(t, 'learned', { title: 'Forgot what Swivel learned', detail: 'Starting fresh from your teams.' });
  }

  tasteSnapshot(): TasteSnapshot {
    return this.learner.snapshot();
  }

  private learn(t: number, lessons: Lesson[]): void {
    for (const l of lessons) this.log(t, 'learned', l);
  }

  /** Catch-up line for a game, from when you last saw it (or the last 6 minutes). */
  private recapFor(gameId: string, t: number): { label: string; text: string } | undefined {
    const info = this.games.get(gameId)!;
    const now = t - info.channel.delayMs;
    const seen = this.lastSeen.get(gameId);
    const from = Math.max(seen ?? -Infinity, now - 8 * 60_000);
    if (now - from < 20_000) return undefined;
    const events = this.timelines.get(gameId)!.eventsBetween(from, now);
    return buildRecap(info, events, now - from, seen === undefined || seen < from);
  }

  // ---------------------------------------------------------------- insights

  private preferenceOf(info: GameInfo): number {
    const codes = [info.home.code, info.away.code];
    if (codes.some((c) => this.prefs.favorites.includes(c))) return 1;
    if (codes.some((c) => this.prefs.likes.includes(c))) return Math.max(0.5, this.learner.boost(info));
    return this.learner.boost(info);
  }

  insight(gameId: string, t: number): GameInsight {
    const info = this.games.get(gameId)!;
    const tl = this.timelines.get(gameId)!;
    const tScreen = t - info.channel.delayMs;
    const screen = tl.snapshotAt(tScreen);
    const feed = tl.snapshotAt(t);
    const displayClock = tl.clockAt(tScreen);
    const margin = screen.homeScore - screen.awayScore;
    const live = screen.phase === 'live' || screen.phase === 'break';
    const leverage = live ? leverageIndex(margin, screen.period, displayClock) : 0;
    const wp = screen.phase === 'pregame' ? 0.5 : homeWinProb(margin, screen.period, displayClock);

    let breakIncomingInMs: number | undefined;
    if (screen.phase === 'live') {
      const upcoming = tl.eventsBetween(tScreen, t).find((e) => BREAK_EVENT_TYPES.includes(e.type));
      if (upcoming) breakIncomingInMs = Math.max(0, upcoming.t + info.channel.delayMs - t);
    }

    let resumeIncomingInMs: number | undefined;
    if (screen.phase === 'break') {
      const back = tl.eventsBetween(tScreen, t).find((e) => !BREAK_EVENT_TYPES.includes(e.type));
      if (back) resumeIncomingInMs = Math.max(0, back.t + info.channel.delayMs - t);
    }

    const tags: InsightTag[] = [];
    const preference = this.preferenceOf(info);
    if (preference >= 1) tags.push('favorite');
    if (screen.phase === 'final') tags.push('final');
    if (screen.phase === 'pregame') tags.push('pregame');
    if (screen.phase === 'break') tags.push('break');
    if (breakIncomingInMs !== undefined) tags.push('break-incoming');
    if (screen.mandatoryArmed) tags.push('mandatory-armed');
    if (live) {
      if (screen.period >= 5) tags.push('overtime');
      if (screen.period >= 4 && leverage >= this.config.mustSeeLeverage) tags.push('crunch');
      else if (leverage >= 1.6) tags.push('close');
      if (leverage < 0.15 && screen.period >= 3) tags.push('blowout');
      const run = currentRun(screen);
      if (run.points >= 8) tags.push('run');
    }
    if (preference >= 1 && this.prefs.loyalty !== 'drama' && !tags.includes('blowout') && (live || screen.phase === 'break'))
      tags.push('team-game');

    const hazard = breakIncomingInMs !== undefined ? 1 : breakHazard(screen, displayClock, leverage);
    const base =
      dramaScore(leverage, tags) * this.learner.dramaWeight() +
      LOYALTY_WEIGHT[this.prefs.loyalty] * preference -
      this.learner.penalty(info);
    const watchScore = screen.phase === 'live' ? base - 0.5 * hazard : screen.phase === 'break' ? base - 2 : -5;

    return {
      info,
      screen,
      feed,
      displayClock,
      homeWinProb: wp,
      leverage,
      breakRisk: hazard,
      breakIncomingInMs,
      breakRemainingMs: breakRemainingMs(screen, tScreen),
      breakElapsedMs: screen.phase === 'break' && screen.breakStartedAt !== undefined ? tScreen - screen.breakStartedAt : undefined,
      resumeIncomingInMs,
      preference,
      watchScore,
      tags,
    };
  }

  private eligible(g: GameInsight): boolean {
    return (
      g.screen.phase === 'live' &&
      !(g.breakIncomingInMs !== undefined && g.breakIncomingInMs < this.config.incomingBreakGuardMs)
    );
  }

  private updateMustSee(all: GameInsight[]): void {
    for (const g of all) {
      const id = g.info.id;
      const over = g.screen.phase === 'final' || g.screen.phase === 'pregame';
      if (over) this.mustSee.delete(id);
      else if (g.tags.includes('crunch')) this.mustSee.add(id);
      else if (g.screen.phase === 'live' && g.leverage < MUST_SEE_EXIT_LEVERAGE) this.mustSee.delete(id);
    }
  }

  // ---------------------------------------------------------------- the loop

  tick(t: number): DirectorView {
    const all = [...this.games.keys()].map((id) => this.insight(id, t));
    const byId = new Map(all.map((g) => [g.info.id, g]));
    const ranked = all.filter((g) => this.eligible(g)).sort((a, b) => b.watchScore - a.watchScore);
    const bestExcept = (exclude: string[]) => ranked.find((g) => !exclude.includes(g.info.id));
    this.updateMustSee(all);

    if (!this.slots.length) this.start(t, all, ranked);
    else if (!this.locked) {
      const handled = this.steerMulti(t, all, byId, ranked);
      if (!handled) this.steerPrimary(t, byId, ranked, bestExcept);
    }

    for (const id of this.slots) {
      const g = byId.get(id);
      if (g && g.screen.phase === 'live') this.lastSeen.set(id, t - g.info.channel.delayMs);
    }
    const onDeck = bestExcept(this.slots)?.info.id;
    const snap = this.learner.snapshot();
    return {
      t,
      layout: this.layout,
      slots: [...this.slots],
      audio: this.audio,
      mustSee: [...this.mustSee],
      locked: this.locked,
      returnTo: this.anchor,
      onDeck,
      insights: all.sort((a, b) => b.watchScore - a.watchScore),
      decisions: [...this.decisions],
      learned: { likes: this.learner.learnedLikes(), dislikes: this.learner.learnedDislikes(), drama: snap.drama, signals: snap.signals },
    };
  }

  private start(t: number, all: GameInsight[], ranked: GameInsight[]): void {
    const first =
      ranked[0] ??
      all
        .filter((g) => g.screen.phase !== 'final')
        .sort((a, b) => a.info.scheduledStart - b.info.scheduledStart || b.preference - a.preference)[0];
    if (!first) return;
    this.slots = [first.info.id];
    this.audio = first.info.id;
    this.lastSwitchAt = t;
    this.lastLayoutAt = t - GROW_MS; // multiview may start right away
    // Tuning in while your team is on a break: come back to them when play resumes.
    const yours = all.find((g) => g.tags.includes('team-game') && g.screen.phase === 'break');
    if (yours && yours.info.id !== first.info.id) {
      this.anchor = yours.info.id;
      this.anchorFromStartup = true;
    }
    const why = whyWatch(first);
    this.log(t, 'start', {
      to: first.info.id,
      title: `Starting with ${matchup(first.info)}`,
      detail: why ? `Best game on right now: ${why}.` : 'Best game on right now.',
      recap: this.recapFor(first.info.id, t),
    });
  }

  private switchPrimary(t: number, to: GameInsight, kind: DecisionKind, title: string, detail: string): void {
    const from = this.slots[0];
    this.slots = [to.info.id];
    this.audio = to.info.id;
    this.lastSwitchAt = t;
    if (kind !== 'break-hop') this.anchor = undefined;
    this.log(t, kind, { from, to: to.info.id, title, detail, recap: this.recapFor(to.info.id, t) });
  }

  private steerPrimary(
    t: number,
    byId: Map<string, GameInsight>,
    ranked: GameInsight[],
    bestExcept: (exclude: string[]) => GameInsight | undefined,
  ): void {
    const P = byId.get(this.slots[0])!;
    const c = this.config;

    // 1. Primary game is over.
    if (P.screen.phase === 'final') {
      const alt = bestExcept(this.slots);
      if (alt) {
        this.switchPrimary(t, alt, 'final-hop', `${matchup(P.info)} is final`, `Moving to ${matchup(alt.info)} · ${situation(alt)}.`);
      }
      return;
    }

    // 2. Primary game is on a stoppage: hop.
    if (P.screen.phase === 'break') {
      const remaining = P.breakRemainingMs ?? 0;
      // Prefer games that will still be live when this break ends (feed lookahead),
      // so one stoppage doesn't turn into two hops.
      const lasting = ranked.find(
        (g) => !this.slots.includes(g.info.id) && !(g.breakIncomingInMs !== undefined && g.breakIncomingInMs < remaining),
      );
      const alt = lasting ?? bestExcept(this.slots);
      if (!alt) return;
      // Short or non-commercial stoppages (replay review, last seconds of a break) only
      // justify a hop if the alternative is clearly better than this game when live.
      const soft = (!isCommercial(P.screen.breakKind) && remaining < c.softBreakMs) || remaining < 20_000;
      if (soft && alt.watchScore < P.watchScore + 2 + c.upgradeMargin) return;
      const breakName = BREAK_NAMES[P.screen.breakKind ?? 'timeout'];
      const back =
        P.resumeIncomingInMs !== undefined
          ? `Back in ${durationLabel(P.resumeIncomingInMs)}.`
          : P.screen.breakKind === 'halftime'
            ? 'Back for the 2nd half.'
            : 'Back the moment play resumes.';
      if (alt.tags.includes('team-game')) this.anchor = undefined; // already where you want to be
      else if (!this.anchor || this.anchor === alt.info.id) {
        this.anchor = P.info.id;
        this.anchorFromStartup = false;
      }
      const why = whyWatch(alt);
      this.switchPrimary(
        t,
        alt,
        'break-hop',
        `${breakName} in ${matchup(P.info)}`,
        `Switching to ${matchup(alt.info)} · ${situation(alt)}${why ? ` (${why})` : ''}. ${back}`,
      );
      return;
    }

    // 3. The game we left for a stoppage is back: return if it's at least about as good.
    const R = this.anchor ? byId.get(this.anchor) : undefined;
    if (R && (R.screen.phase === 'final' || R.info.id === P.info.id)) this.anchor = undefined;
    else if (R && this.eligible(R)) {
      this.anchor = undefined;
      const yours = R.tags.includes('team-game');
      const neverThere = this.anchorFromStartup;
      this.anchorFromStartup = false;
      if (yours || R.watchScore >= P.watchScore - c.returnBias) {
        if (neverThere) {
          this.switchPrimary(t, R, 'return', `Your team is back on`, `Play resumed in ${matchup(R.info)} · ${situation(R)}.`);
        } else {
          this.switchPrimary(t, R, 'return', `Play resumed in ${matchup(R.info)}`, `${yours ? 'Your team. ' : ''}Taking you back · ${situation(R)}.`);
        }
      } else {
        this.log(t, 'hold', {
          from: P.info.id,
          to: R.info.id,
          title: `Staying on ${matchup(P.info)}`,
          detail: `${matchup(R.info)} is back, but this one is better right now (${whyWatch(P) || situation(P)}).`,
        });
      }
      return;
    }
    if (R) return; // still waiting on the anchor game; don't wander off on upgrades

    // 4. Team first: if one of your teams is live and we're not on it, go there now.
    if (this.prefs.loyalty === 'team-first' && !P.tags.includes('team-game') && t >= this.manualHoldUntil) {
      const mine = ranked.find((g) => g.tags.includes('team-game') && g.info.id !== P.info.id);
      if (mine && !(this.mustSee.has(P.info.id) && !this.mustSee.has(mine.info.id) && P.leverage > 2 * mine.leverage)) {
        this.switchPrimary(t, mine, 'upgrade', `Your team: ${matchup(mine.info)}`, `${situation(mine)}.`);
        return;
      }
    }

    // 5. Opportunistic upgrade, with dwell time and hysteresis so we never thrash.
    const dwell = t < this.manualHoldUntil ? Infinity : c.minDwellMs;
    if (t - this.lastSwitchAt < dwell) return;
    const best = bestExcept(this.slots);
    if (best && best.watchScore > P.watchScore + c.upgradeMargin) {
      const why = whyWatch(best);
      this.switchPrimary(
        t,
        best,
        'upgrade',
        `${matchup(best.info)} is heating up`,
        `${situation(best)}${why ? ` · ${why}` : ''}.`,
      );
    }
  }

  /** Games that deserve a tile right now: crunch time anywhere, or your team. */
  private featured(all: GameInsight[]): GameInsight[] {
    return all.filter(
      (g) =>
        g.screen.phase !== 'final' &&
        g.screen.phase !== 'pregame' &&
        (this.mustSee.has(g.info.id) || g.tags.includes('team-game')),
    );
  }

  /** On air = actual game action on screen (live, or a replay review), not a commercial. */
  private onAir(g: GameInsight): boolean {
    return g.screen.phase === 'live' || (g.screen.phase === 'break' && !isCommercial(g.screen.breakKind));
  }

  /** Team games first, then by watch score. */
  private tileOrder(a: GameInsight, b: GameInsight): number {
    return Number(b.tags.includes('team-game')) - Number(a.tags.includes('team-game')) || b.watchScore - a.watchScore;
  }

  /**
   * Multiview: show every featured game that is on air (2 = split, 3 = trio, 4 = quad),
   * as long as at least one of them is in crunch time. A game that goes to commercial
   * leaves the grid immediately and the layout collapses; it comes back when play
   * resumes. Returns true when it handled this tick.
   */
  private steerMulti(t: number, all: GameInsight[], byId: Map<string, GameInsight>, ranked: GameInsight[]): boolean {
    const manualHold = t < this.manualHoldUntil;
    if (!this.prefs.multiview || manualHold) {
      if (this.layout !== 'single' && !manualHold) this.collapseTo(t, byId, ranked, 'Multiview is off', '');
      return false;
    }
    const guard = this.config.incomingBreakGuardMs;
    const air = this.featured(all)
      .filter((g) => this.onAir(g))
      .sort((a, b) => this.tileOrder(a, b));
    const worthy = air.length >= 2 && air.some((g) => this.mustSee.has(g.info.id));
    const desired = worthy ? air.slice(0, 4) : [];
    const canGrow = t - this.lastLayoutAt >= GROW_MS;

    if (this.layout === 'single') {
      const joinable = desired.filter((g) => !(g.breakIncomingInMs !== undefined && g.breakIncomingInMs < guard));
      if (joinable.length < 2 || !canGrow) return false;
      const primary = this.slots[0];
      const ids = joinable.map((g) => g.info.id);
      const ordered = ids.includes(primary) && !joinable[0].tags.includes('team-game') ? [primary, ...ids.filter((id) => id !== primary)] : ids;
      this.slots = ordered;
      this.layout = LAYOUT_FOR[ordered.length];
      this.lastLayoutAt = t;
      this.anchor = undefined;
      this.coolingSince.clear();
      this.pickAudio(byId);
      this.log(t, 'multiview-on', {
        title: this.multiTitle(joinable),
        detail: `${joinable.map((g) => `${matchup(g.info)} (${situation(g)})`).join(', ')}. Audio: ${matchup(byId.get(this.audio!)!.info)}.`,
      });
      return true;
    }

    // Already in multiview: drop tiles that went to commercial, ended, or cooled off.
    const desiredIds = new Set(desired.map((g) => g.info.id));
    const removed: Array<[GameInsight, string]> = [];
    let next = this.slots.filter((id) => {
      const g = byId.get(id)!;
      if (g.screen.phase === 'final') {
        removed.push([g, 'is final']);
        return false;
      }
      if (!this.onAir(g)) {
        removed.push([g, `went to ${g.screen.breakKind === 'halftime' ? 'halftime' : 'commercial'}`]);
        this.benched.add(id);
        return false;
      }
      if (desiredIds.has(id)) {
        this.coolingSince.delete(id);
        return true;
      }
      const since = this.coolingSince.get(id) ?? t;
      this.coolingSince.set(id, since);
      if (t - since >= COOL_OFF_MS) {
        this.coolingSince.delete(id);
        removed.push([g, 'cooled off']);
        return false;
      }
      return true;
    });

    // Add games that are (back) on air and featured.
    const added: GameInsight[] = [];
    if (canGrow || removed.length) {
      for (const g of desired) {
        if (next.length >= 4) break;
        if (next.includes(g.info.id)) continue;
        if (g.breakIncomingInMs !== undefined && g.breakIncomingInMs < guard) continue;
        if (g.tags.includes('team-game')) next = [g.info.id, ...next];
        else next.push(g.info.id);
        added.push(g);
      }
    }

    if (!removed.length && !added.length) {
      this.pickAudio(byId, t);
      return true;
    }

    if (next.length <= 1) {
      const why = removed.map(([g, r]) => `${matchup(g.info)} ${r}`).join('; ');
      this.collapseTo(t, byId, ranked, removed.length ? capitalize(why) : 'Back to full screen', next[0]);
      return true;
    }

    this.slots = next;
    this.layout = LAYOUT_FOR[next.length];
    this.lastLayoutAt = t;
    this.pickAudio(byId);
    const parts: string[] = [];
    for (const [g, r] of removed) parts.push(`${matchup(g.info)} ${r}`);
    for (const g of added) {
      parts.push(`${matchup(g.info)} ${this.benched.has(g.info.id) ? 'is back' : 'joins'}`);
      this.benched.delete(g.info.id);
    }
    this.log(t, 'tile-swap', {
      recap: added[0] ? this.recapFor(added[0].info.id, t) : undefined,
      title: capitalize(parts.join('; ')),
      detail: `${this.layoutName()}: ${next.map((id) => matchup(byId.get(id)!.info)).join(', ')}. Audio: ${matchup(byId.get(this.audio!)!.info)}.`,
    });
    return true;
  }

  private collapseTo(t: number, byId: Map<string, GameInsight>, ranked: GameInsight[], title: string, keepId?: string): void {
    const keep = (keepId && byId.get(keepId)) || ranked.find((g) => g.tags.includes('team-game')) || ranked[0];
    const prevAudio = this.audio;
    this.layout = 'single';
    this.lastLayoutAt = t;
    this.coolingSince.clear();
    if (!keep) return;
    this.slots = [keep.info.id];
    this.audio = keep.info.id;
    this.lastSwitchAt = t;
    // If a game we were featuring is on a break, remember it so we come back.
    for (const id of this.slots) if (byId.get(id)?.screen.phase === 'break') this.benched.add(id);
    const pending = prevAudio && byId.get(prevAudio);
    if (pending && pending.info.id !== keep.info.id && pending.screen.phase === 'break') {
      this.anchor = pending.info.id;
      this.anchorFromStartup = false;
    }
    this.log(t, 'multiview-off', { to: keep.info.id, title, detail: `Full screen: ${matchup(keep.info)} · ${situation(keep)}.` });
  }

  /** Audio: your team if it's on air, else stay put while live, else the best on-air tile. */
  private pickAudio(byId: Map<string, GameInsight>, t?: number): void {
    const tiles = this.slots.map((id) => byId.get(id)!);
    const yours = tiles.find((g) => g.tags.includes('team-game') && this.onAir(g));
    const current = tiles.find((g) => g.info.id === this.audio && this.onAir(g));
    const best = yours ?? current ?? [...tiles].sort((a, b) => b.watchScore - a.watchScore)[0];
    if (!best || best.info.id === this.audio) return;
    const from = this.audio;
    this.audio = best.info.id;
    if (t !== undefined)
      this.log(t, 'tile-swap', { from, to: best.info.id, title: `Audio to ${matchup(best.info)}`, detail: situation(best) + '.' });
  }

  private multiTitle(games: GameInsight[]): string {
    const yours = games.find((g) => g.tags.includes('team-game'));
    if (yours) return `Your team plus ${games.length - 1 === 1 ? 'a game' : `${games.length - 1} games`} going down to the wire`;
    return games.length >= 4 ? 'Quad box: crunch time everywhere' : games.length === 3 ? 'Three games in crunch time' : 'Two games down to the wire';
  }

  private layoutName(): string {
    return { single: 'Full screen', split: 'Split screen', trio: 'Three-up', quad: 'Quad box' }[this.layout];
  }

  private log(
    t: number,
    kind: DecisionKind,
    d: { from?: string; to?: string; title: string; detail: string; recap?: { label: string; text: string } },
  ): void {
    this.decisions.push({ t, kind, layout: this.layout, ...d });
    if (this.decisions.length > MAX_DECISIONS) this.decisions.splice(0, this.decisions.length - MAX_DECISIONS);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
