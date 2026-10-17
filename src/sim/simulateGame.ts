import { between, makeRng, pick, weighted, type Rng } from '../rng';
import type { FeedEvent, FeedEventType, GameInfo, Side } from '../types';

/**
 * Possession-level pro-basketball simulator that emits a play-by-play feed with
 * realistic stoppages: team timeouts (to stop runs and late in close games),
 * mandatory media timeouts (first dead ball under 7:00 and 3:00 of each quarter),
 * quarter breaks, halftime, overtime, and occasional replay reviews.
 */
export interface SimOptions {
  seed: number;
  /** Rating edge for the home team in points per 100 possessions. */
  homeEdge?: number;
  /** 0..1 pull of the trailing team back toward even late in games. */
  rubberBand?: number;
}

const PERIOD = 720;
const OT = 300;
const WALL = {
  timeout: [130, 170],
  mandatory: [150, 180],
  quarter: [125, 145],
  halftime: [900, 900],
  overtime: [125, 140],
  review: [45, 95],
  freeThrow: [9, 14],
  foul: [10, 22],
  deadBall: [4, 9],
} as const;

const SHOTS2 = ['layup', 'jumper', 'dunk', 'floater', 'hook shot', 'putback'];
const SHOTS3 = ['3-pointer', 'corner three', 'step-back three', 'pull-up three'];

export function simulateGame(info: GameInfo, opts: SimOptions): FeedEvent[] {
  const rng: Rng = makeRng(opts.seed);
  const homeEdge = opts.homeEdge ?? between(rng, -6, 8);
  const rubber = opts.rubberBand ?? 0.35;
  const events: FeedEvent[] = [];
  const score = { home: 0, away: 0 };
  const timeoutsLeft = { home: 7, away: 7 };
  let t = info.scheduledStart;
  let period = 1;
  let clock = PERIOD;
  let seq = 0;
  let poss: Side = rng() < 0.5 ? 'home' : 'away';
  let lastScorer: Side | undefined;
  let runPts = 0;
  let mandatoryDone = 0;

  const code = (s: Side) => (s === 'home' ? info.home.code : info.away.code);
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
  const wall = (k: keyof typeof WALL) => between(rng, WALL[k][0], WALL[k][1]) * 1000;
  const lateClockStops = () => period >= 4 && clock <= 120;

  const emit = (type: FeedEventType, text: string, extra: Partial<FeedEvent> = {}, running = true) => {
    events.push({
      gameId: info.id,
      seq: seq++,
      t: Math.round(t),
      type,
      period,
      clock: Math.round(clock * 10) / 10,
      clockRunning: running,
      homeScore: score.home,
      awayScore: score.away,
      text,
      ...extra,
    });
  };

  const addPoints = (side: Side, pts: number) => {
    score[side] += pts;
    if (lastScorer === side) runPts += pts;
    else {
      lastScorer = side;
      runPts = pts;
    }
  };

  const stoppage = (kind: 'timeout' | 'mandatory' | 'review', caller?: Side) => {
    if (kind === 'timeout' && caller) {
      timeoutsLeft[caller]--;
      emit('timeout', `Timeout ${code(caller)}`, { team: caller }, false);
    } else if (kind === 'mandatory') {
      emit('mandatory_timeout', 'Media timeout', {}, false);
    } else {
      emit('review', 'Replay review', {}, false);
    }
    if (kind !== 'review' && period <= 4) {
      const windows = [420, 180].filter((w) => clock < w).length;
      mandatoryDone = Math.max(mandatoryDone, windows);
    }
    t += wall(kind);
    if (kind !== 'review') runPts = 0; // a timeout "breaks" the run for timeout-calling purposes
    emit('resume', 'Play resumes', {}, true);
  };

  /** Called at each dead ball: is there a stoppage? */
  const deadBall = (againstRun: Side | undefined) => {
    if (period <= 4) {
      const windows = [420, 180].filter((w) => clock < w).length;
      if (windows > mandatoryDone && clock > 0) {
        stoppage('mandatory');
        return;
      }
    }
    const margin = Math.abs(score.home - score.away);
    const late = period >= 4 && clock < 150 && margin <= 8;
    if (againstRun && runPts >= 8 && timeoutsLeft[againstRun] > 0 && rng() < 0.55) {
      stoppage('timeout', againstRun);
      return;
    }
    if (late) {
      const trailing: Side = score.home < score.away ? 'home' : score.home > score.away ? 'away' : poss;
      if (timeoutsLeft[trailing] > 0 && rng() < 0.22) {
        stoppage('timeout', trailing);
        return;
      }
      if (rng() < 0.05) {
        stoppage('review');
        return;
      }
    }
    if (rng() < 0.012) {
      const side: Side = rng() < 0.5 ? 'home' : 'away';
      if (timeoutsLeft[side] > 2) stoppage('timeout', side);
    }
  };

  emit('tipoff', `Tip-off: ${info.away.city} at ${info.home.city}`, {}, true);

  for (;;) {
    // --- one possession
    const margin = score[poss] - score[other(poss)];
    const late = period >= 4 && clock < 120;
    let dur = between(rng, 8, 20);
    if (late && margin < 0) dur = between(rng, 5, 10); // trailing team hurries
    if (late && margin > 0 && margin <= 6) dur = between(rng, 14, 24); // leader milks clock
    if (dur >= clock) dur = clock;
    clock -= dur;
    t += dur * 1000;

    if (clock <= 0) {
      clock = 0;
      // Last possession: maybe a buzzer-beater attempt.
      if (rng() < 0.4) {
        const three = rng() < 0.45;
        if (rng() < (three ? 0.3 : 0.42)) {
          addPoints(poss, three ? 3 : 2);
          emit('score', `${code(poss)} ${three ? 'buzzer-beating three' : 'shot at the horn'}!`, { team: poss, points: three ? 3 : 2 }, false);
        } else emit('miss', `${code(poss)} miss at the buzzer`, { team: poss }, false);
      }
      emit('period_end', `End of ${period <= 4 ? `Q${period}` : `OT${period - 4}`}`, {}, false);
      if (period >= 4 && score.home !== score.away) {
        emit('game_end', `Final: ${info.away.code} ${score.away}, ${info.home.code} ${score.home}`, {}, false);
        return events;
      }
      t += wall(period === 2 ? 'halftime' : period >= 4 ? 'overtime' : 'quarter');
      period++;
      clock = period <= 4 ? PERIOD : OT;
      mandatoryDone = 0;
      lastScorer = undefined;
      runPts = 0;
      poss = rng() < 0.5 ? 'home' : 'away';
      emit('period_start', `Start of ${period <= 4 ? `Q${period}` : `OT${period - 4}`}`, {}, true);
      continue;
    }

    // Outcome probabilities with team strength and late-game rubber band.
    const edge = (poss === 'home' ? homeEdge : -homeEdge) / 100;
    const lateness = period >= 3 ? Math.min(1, (period - 2) / 2) : 0;
    const band = margin < 0 ? Math.min(0.06, (-margin / 100) * rubber * 2 * lateness) : -Math.min(0.04, (margin / 100) * rubber * lateness);
    const p2 = 0.315 + edge * 0.6 + band;
    const p3 = 0.115 + edge * 0.3 + band * 0.5 + (late && margin < -2 ? 0.08 : 0);
    const outcome = weighted(rng, [
      ['make2', p2],
      ['make3', p3],
      ['miss', 0.39],
      ['turnover', 0.12],
      ['foul', 0.08 + (late && margin > 0 ? 0.1 : 0)],
    ] as const);

    const shooter = poss;
    let dead = false;
    let deadAgainst: Side | undefined;
    switch (outcome) {
      case 'make2':
      case 'make3': {
        const pts = outcome === 'make3' ? 3 : 2;
        addPoints(shooter, pts);
        const stops = lateClockStops();
        emit('score', `${code(shooter)} ${pick(rng, pts === 3 ? SHOTS3 : SHOTS2)}`, { team: shooter, points: pts }, !stops);
        if (stops) t += wall('deadBall');
        dead = true; // inbound after a make is a dead ball (timeouts allowed)
        deadAgainst = other(shooter);
        poss = other(shooter);
        break;
      }
      case 'miss': {
        emit('miss', `${code(shooter)} misses ${pick(rng, rng() < 0.4 ? SHOTS3 : SHOTS2)}`, { team: shooter }, true);
        const oreb = rng() < 0.25;
        emit('rebound', `${code(oreb ? shooter : other(shooter))} rebound`, { team: oreb ? shooter : other(shooter) }, true);
        if (!oreb) poss = other(shooter);
        break;
      }
      case 'turnover': {
        const outOfBounds = rng() < 0.5;
        emit('turnover', `${code(shooter)} turnover${outOfBounds ? ' (out of bounds)' : ' (steal)'}`, { team: shooter }, !outOfBounds);
        if (outOfBounds) {
          t += wall('deadBall');
          dead = true;
          deadAgainst = shooter;
        }
        poss = other(shooter);
        break;
      }
      case 'foul': {
        const fouled = shooter;
        emit('foul', `Shooting foul on ${code(other(fouled))}`, { team: other(fouled) }, false);
        t += wall('foul');
        let made = 0;
        for (let i = 0; i < 2; i++) {
          const make = rng() < 0.78;
          if (make) {
            made++;
            addPoints(fouled, 1);
          }
          t += wall('freeThrow');
          emit('freethrow', `${code(fouled)} free throw ${i + 1} of 2 ${make ? 'good' : 'missed'}`, make ? { team: fouled, points: 1 } : { team: fouled }, i === 1);
        }
        dead = true;
        deadAgainst = made > 0 ? other(fouled) : undefined;
        poss = other(fouled);
        break;
      }
    }

    if (dead) deadBall(deadAgainst && lastScorer !== deadAgainst ? deadAgainst : undefined);
  }
}
