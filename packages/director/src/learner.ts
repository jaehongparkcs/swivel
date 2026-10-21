import type { GameInfo, GameInsight } from './types';

/**
 * Learns your taste from what you do with the remote, on the device, with no
 * account or network:
 *  - picking a game (OK) is a vote for the teams in it, and a small vote
 *    against the game you left;
 *  - skipping (Fast-forward) is a vote against the game you were on;
 *  - holding a game (Play/Pause) is a vote for it;
 *  - which way you move (toward closer games, or toward your teams) tunes how
 *    much drama matters relative to loyalty.
 *
 * A vote on a game is split between its two teams. With no history the split
 * is even; once one team stands out (explicitly or from earlier votes), a
 * positive vote leans toward it and a negative vote leans toward the other
 * one. That way picking your favorite's game doesn't teach "likes the
 * opponent" as fast, and the learner can tell "likes this team" apart from
 * "liked this one game".
 *
 * Team affinities live in [-1, 1]; drama appetite in [0, 1] (0.5 = neutral).
 */
export interface TasteSnapshot {
  teams: Record<string, number>;
  drama: number;
  signals: number;
}

export type Lesson = { title: string; detail: string };

const LIKE_THRESHOLD = 0.5;
const DISLIKE_THRESHOLD = -0.4;

/** Largest share of one vote either team can take. */
const MAX_SHARE = 0.8;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export class TasteLearner {
  private teams = new Map<string, number>();
  private drama = 0.5;
  private signals = 0;
  private announced = new Set<string>();
  /** Explicit preference per team (favorites, likes), used only to split credit. */
  private prior: (code: string) => number = () => 0;

  constructor(snapshot?: TasteSnapshot) {
    if (snapshot) {
      this.teams = new Map(Object.entries(snapshot.teams));
      this.drama = snapshot.drama;
      this.signals = snapshot.signals;
    }
  }

  setPrior(prior: (code: string) => number): void {
    this.prior = prior;
  }

  private bump(code: string, delta: number): void {
    this.teams.set(code, clamp((this.teams.get(code) ?? 0) + delta, -1, 1));
  }

  /**
   * Apply a vote of `perTeam` (per team, as if split evenly) to a game. Positive
   * votes lean toward the team you already like more, negative votes away from it.
   */
  private credit(info: GameInfo, perTeam: number): void {
    const { home, away } = info;
    const lean = (code: string) => this.affinity(code) + this.prior(code);
    const diff = clamp(lean(home.code) - lean(away.code), -1, 1);
    const homeShare = clamp(0.5 + (perTeam > 0 ? diff : -diff) * 0.5, 1 - MAX_SHARE, MAX_SHARE);
    this.bump(home.code, 2 * perTeam * homeShare);
    this.bump(away.code, 2 * perTeam * (1 - homeShare));
  }

  private nudgeDrama(picked: GameInsight, left?: GameInsight): void {
    if (!left) return;
    const diff = Math.log2(1 + picked.leverage) - Math.log2(1 + left.leverage);
    if (Math.abs(diff) > 0.3) this.drama = clamp(this.drama + Math.sign(diff) * 0.08, 0, 1);
  }

  onPick(picked: GameInsight, left?: GameInsight): Lesson[] {
    this.signals++;
    this.credit(picked.info, 0.3);
    if (left && left.info.id !== picked.info.id) this.credit(left.info, -0.08);
    this.nudgeDrama(picked, left);
    return this.lessons();
  }

  onSkip(current: GameInsight, next?: GameInsight): Lesson[] {
    this.signals++;
    this.credit(current.info, -0.2);
    if (next) this.nudgeDrama(next, current);
    return this.lessons();
  }

  onHold(current: GameInsight): Lesson[] {
    this.signals++;
    this.credit(current.info, 0.15);
    return this.lessons();
  }

  affinity(code: string): number {
    return this.teams.get(code) ?? 0;
  }

  /** Extra preference (0..0.6) for a game from learned team affinity. */
  boost(info: GameInfo): number {
    const a = Math.max(this.affinity(info.home.code), this.affinity(info.away.code));
    return a > 0 ? 0.6 * a : 0;
  }

  /** Watch-score penalty for games whose teams you keep skipping. */
  penalty(info: GameInfo): number {
    const a = Math.min(this.affinity(info.home.code), this.affinity(info.away.code));
    return a < 0 ? 0.8 * -a : 0;
  }

  /** Multiplier on drama (leverage) relative to loyalty: 0.7 .. 1.3. */
  dramaWeight(): number {
    return 0.7 + 0.6 * this.drama;
  }

  learnedLikes(): string[] {
    return [...this.teams.entries()].filter(([, a]) => a >= LIKE_THRESHOLD).map(([c]) => c);
  }

  learnedDislikes(): string[] {
    return [...this.teams.entries()].filter(([, a]) => a <= DISLIKE_THRESHOLD).map(([c]) => c);
  }

  snapshot(): TasteSnapshot {
    return { teams: Object.fromEntries(this.teams), drama: this.drama, signals: this.signals };
  }

  reset(): void {
    this.teams.clear();
    this.drama = 0.5;
    this.signals = 0;
    this.announced.clear();
  }

  /** New, human-readable things we've learned since last time (each said once). */
  private lessons(): Lesson[] {
    const out: Lesson[] = [];
    for (const c of this.learnedLikes()) {
      const key = `like:${c}`;
      if (this.announced.has(key)) continue;
      this.announced.add(key);
      out.push({
        title: `Learned: you like ${c}`,
        detail: `You keep picking their games, so they'll get priority. Change it in Your teams.`,
      });
    }
    for (const c of this.learnedDislikes()) {
      const key = `skip:${c}`;
      if (this.announced.has(key)) continue;
      this.announced.add(key);
      out.push({ title: `Learned: you skip ${c}`, detail: `We'll show their games less unless they get tight.` });
    }
    if (this.drama >= 0.74 && !this.announced.has('drama:high')) {
      this.announced.add('drama:high');
      out.push({
        title: 'Learned: you chase close games',
        detail: 'Tight finishes will weigh more when picking what to show.',
      });
    }
    if (this.drama <= 0.26 && !this.announced.has('drama:low')) {
      this.announced.add('drama:low');
      out.push({
        title: 'Learned: you stick with your teams',
        detail: "We'll pull you away for other games less often.",
      });
    }
    return out;
  }
}
