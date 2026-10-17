import { BREAK_EVENT_TYPES, breakHazard, breakRemainingMs, currentRun, isCommercial } from './breakModel';
import { BREAK_NAMES, durationLabel, matchup, situation, whyWatch } from './explain';
import { GameTimeline } from './gameState';
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

const LOYALTY_WEIGHT: Record<Loyalty, number> = { 'team-first': 2.6, balanced: 1.2, drama: 0.3 };
const SLOTS: Record<Layout, number> = { single: 1, split: 2, quad: 4 };
/** A must-see game stays must-see until its leverage falls below this. */
const MUST_SEE_EXIT_LEVERAGE = 1.8;
/** How long a smaller layout must be warranted before we shrink. */
const LAYOUT_SHRINK_MS = 30_000;
const MAX_DECISIONS = 60;
/** A multiview tile on a commercial break longer than this gets swapped out. */
const TILE_SWAP_REMAINING_MS = 40_000;

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
  private layoutDownSince?: number;
  private locked = false;
  /**
   * The game the viewer was really watching before stoppages sent us elsewhere.
   * Hopping again from a fill-in game keeps the original anchor, so we never
   * cascade back through every game we passed through.
   */
  private anchor?: string;
  private lastSwitchAt = -Infinity;
  private lastLayoutAt = -Infinity;
  private manualHoldUntil = -Infinity;
  private decisions: Decision[] = [];

  constructor(games: GameInfo[], prefs: TeamPrefs = DEFAULT_PREFS, config: Partial<DirectorConfig> = {}) {
    for (const g of games) {
      this.games.set(g.id, g);
      this.timelines.set(g.id, new GameTimeline(g.id));
    }
    this.prefs = prefs;
    this.config = { ...DEFAULT_CONFIG, ...config };
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

  getPrefs(): TeamPrefs {
    return this.prefs;
  }

  toggleLock(t: number): void {
    this.locked = !this.locked;
    const primary = this.audio && this.games.get(this.audio);
    this.log(t, this.locked ? 'lock' : 'unlock', {
      title: this.locked ? 'Autopilot paused' : 'Autopilot on',
      detail: this.locked
        ? `Staying on ${primary ? matchup(primary) : 'this game'} until you unlock.`
        : 'Fastbreak will hop on breaks and bring you to tight games.',
    });
  }

  isLocked(): boolean {
    return this.locked;
  }

  /** Viewer picked a game with the remote. */
  manualSelect(gameId: string, t: number): void {
    const info = this.games.get(gameId);
    if (!info) return;
    const from = this.slots[0];
    this.slots = [gameId];
    this.audio = gameId;
    this.layout = 'single';
    this.anchor = undefined;
    this.lastSwitchAt = t;
    this.lastLayoutAt = t;
    this.manualHoldUntil = t + this.config.minDwellMs * 2;
    this.log(t, 'manual', { from, to: gameId, title: `Watching ${matchup(info)}`, detail: 'Your pick. Autopilot still covers breaks.' });
  }

  // ---------------------------------------------------------------- insights

  private preferenceOf(info: GameInfo): number {
    const codes = [info.home.code, info.away.code];
    if (codes.some((c) => this.prefs.favorites.includes(c))) return 1;
    if (codes.some((c) => this.prefs.likes.includes(c))) return 0.5;
    return 0;
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

    const hazard = breakIncomingInMs !== undefined ? 1 : breakHazard(screen, displayClock, leverage);
    const base = dramaScore(leverage, tags) + LOYALTY_WEIGHT[this.prefs.loyalty] * preference;
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
      const layoutChanged = this.steerLayout(t, byId, ranked);
      if (!layoutChanged) {
        if (this.layout === 'single') this.steerPrimary(t, byId, ranked, bestExcept);
        else this.steerTiles(t, byId, ranked);
      }
    }

    const onDeck = bestExcept(this.slots)?.info.id;
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
    this.lastLayoutAt = t;
    const why = whyWatch(first);
    this.log(t, 'start', {
      to: first.info.id,
      title: `Starting with ${matchup(first.info)}`,
      detail: why ? `Best game on right now: ${why}.` : 'Best game on right now.',
    });
  }

  private switchPrimary(t: number, to: GameInsight, kind: DecisionKind, title: string, detail: string): void {
    const from = this.slots[0];
    this.slots = [to.info.id];
    this.audio = to.info.id;
    this.lastSwitchAt = t;
    if (kind !== 'break-hop') this.anchor = undefined;
    this.log(t, kind, { from, to: to.info.id, title, detail });
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
      const back = P.screen.breakKind === 'halftime' ? 'Back for the 2nd half.' : `Back in ~${durationLabel(remaining)}.`;
      if (!this.anchor || this.anchor === alt.info.id) this.anchor = P.info.id;
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
      if (R.watchScore >= P.watchScore - c.returnBias) {
        this.switchPrimary(t, R, 'return', `Play resumed in ${matchup(R.info)}`, `Taking you back · ${situation(R)}.`);
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

    // 4. Opportunistic upgrade, with dwell time and hysteresis so we never thrash.
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

  /** Decide single / split / quad. Returns true if the layout changed this tick. */
  private steerLayout(t: number, byId: Map<string, GameInsight>, ranked: GameInsight[]): boolean {
    const n = this.mustSee.size;
    const want: Layout = !this.prefs.multiview ? 'single' : n >= 3 ? 'quad' : n >= 2 ? 'split' : 'single';
    if (want === this.layout) {
      this.layoutDownSince = undefined;
      return false;
    }
    if (t < this.manualHoldUntil) return false;
    const since = t - this.lastLayoutAt;
    if (SLOTS[want] > SLOTS[this.layout]) {
      this.layoutDownSince = undefined;
      if (since < 10_000) return false;
    } else {
      if (this.layoutDownSince === undefined) this.layoutDownSince = t;
      const prefOff = !this.prefs.multiview;
      if (!prefOff && (t - this.layoutDownSince < LAYOUT_SHRINK_MS || since < this.config.minLayoutMs)) return false;
    }

    const prevLayout = this.layout;
    this.layout = want;
    this.lastLayoutAt = t;
    this.layoutDownSince = undefined;
    this.anchor = undefined;

    if (want === 'single') {
      const tiles = this.slots.map((id) => byId.get(id)!);
      const keep =
        tiles.find((g) => g.info.id === this.audio && this.eligible(g)) ??
        tiles.filter((g) => this.eligible(g)).sort((a, b) => b.watchScore - a.watchScore)[0] ??
        ranked[0] ??
        byId.get(this.audio ?? this.slots[0])!;
      this.slots = [keep.info.id];
      this.audio = keep.info.id;
      this.lastSwitchAt = t;
      this.log(t, 'multiview-off', {
        to: keep.info.id,
        title: 'Back to full screen',
        detail: `${matchup(keep.info)} · ${situation(keep)}.`,
      });
      return true;
    }

    // Growing or shrinking between multiview layouts: keep must-see tiles in place.
    const size = SLOTS[want];
    let next = [...this.slots];
    if (size < next.length) {
      const must = next.filter((id) => this.mustSee.has(id));
      const rest = next.filter((id) => !this.mustSee.has(id));
      next = [...must, ...rest].slice(0, size);
    }
    this.slots = next;
    this.fillTiles(byId, ranked);
    this.pickAudio(t, byId, false);
    const names = this.slots.map((id) => matchup(byId.get(id)!.info)).join(' · ');
    this.log(t, 'multiview-on', {
      title:
        want === 'quad'
          ? 'Quad box: crunch time everywhere'
          : prevLayout === 'quad'
            ? 'Down to two games that matter'
            : 'Split screen: two games down to the wire',
      detail: `${names}. Audio follows ${matchup(byId.get(this.audio!)!.info)}.`,
    });
    return true;
  }

  /** Put every must-see game on screen, then fill spare tiles with the best of the rest. */
  private fillTiles(byId: Map<string, GameInsight>, ranked: GameInsight[], t?: number): void {
    const size = SLOTS[this.layout];
    const next = this.slots.filter((id) => byId.get(id)!.screen.phase !== 'final');
    const filler = (id: string) => !this.mustSee.has(id);

    const missing = [...this.mustSee]
      .filter((id) => !next.includes(id))
      .sort((a, b) => byId.get(b)!.watchScore - byId.get(a)!.watchScore);
    for (const id of missing) {
      if (next.length < size) next.push(id);
      else {
        const victims = next.filter(filler).sort((a, b) => byId.get(a)!.watchScore - byId.get(b)!.watchScore);
        if (!victims.length) break;
        next[next.indexOf(victims[0])] = id;
      }
    }

    // Fillers on long commercial breaks get replaced by something live.
    for (let i = 0; i < next.length; i++) {
      const g = byId.get(next[i])!;
      if (!filler(g.info.id)) continue;
      const stale =
        g.screen.phase === 'break' && isCommercial(g.screen.breakKind) && (g.breakRemainingMs ?? 0) > TILE_SWAP_REMAINING_MS;
      if (!stale) continue;
      const repl = ranked.find((r) => !next.includes(r.info.id));
      if (!repl) continue;
      next[i] = repl.info.id;
      if (t !== undefined)
        this.log(t, 'tile-swap', {
          from: g.info.id,
          to: repl.info.id,
          title: `${matchup(g.info)} went to break`,
          detail: `Filling the tile with ${matchup(repl.info)} · ${situation(repl)}.`,
        });
    }
    while (next.length < size) {
      const repl = ranked.find((r) => !next.includes(r.info.id));
      if (!repl) break;
      next.push(repl.info.id);
    }
    // Pad with anything still going so the grid is full.
    if (next.length < size) {
      for (const g of [...byId.values()].sort((a, b) => b.watchScore - a.watchScore)) {
        if (next.length >= size) break;
        if (!next.includes(g.info.id) && g.screen.phase !== 'final') next.push(g.info.id);
      }
    }
    this.slots = next;
  }

  /** Audio stays put while its game is live; otherwise it moves to the best live tile. */
  private pickAudio(t: number, byId: Map<string, GameInsight>, announce: boolean): void {
    const current = this.audio && this.slots.includes(this.audio) ? byId.get(this.audio) : undefined;
    if (current && current.screen.phase === 'live') return;
    const live = this.slots
      .map((id) => byId.get(id)!)
      .filter((g) => g.screen.phase === 'live')
      .sort((a, b) => Number(this.mustSee.has(b.info.id)) - Number(this.mustSee.has(a.info.id)) || b.watchScore - a.watchScore);
    const best = live[0] ?? byId.get(this.slots[0]);
    if (!best || best.info.id === this.audio) return;
    const from = this.audio;
    this.audio = best.info.id;
    if (announce && current)
      this.log(t, 'break-hop', {
        from,
        to: best.info.id,
        title: `Audio to ${matchup(best.info)}`,
        detail: `${BREAK_NAMES[current.screen.breakKind ?? 'timeout']} in ${matchup(current.info)}.`,
      });
  }

  private steerTiles(t: number, byId: Map<string, GameInsight>, ranked: GameInsight[]): void {
    this.fillTiles(byId, ranked, t);
    this.pickAudio(t, byId, true);
  }

  private log(t: number, kind: DecisionKind, d: { from?: string; to?: string; title: string; detail: string }): void {
    this.decisions.push({ t, kind, layout: this.layout, ...d });
    if (this.decisions.length > MAX_DECISIONS) this.decisions.splice(0, this.decisions.length - MAX_DECISIONS);
  }
}
