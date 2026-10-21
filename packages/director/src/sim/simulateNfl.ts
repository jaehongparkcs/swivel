import { between, makeRng, weighted, type Rng } from '../rng';
import type { FeedEvent, FeedEventType, GameInfo, Side } from '../types';
import type { SimOptions } from './simulateGame';

/**
 * Play-level football simulator: drives of runs and passes with downs, field
 * position, punts, field goals, touchdowns and turnovers, and the stoppages a
 * broadcast actually has: TV timeouts after scores, kickoffs and some changes of
 * possession, the two-minute warning, quarter breaks, halftime, team timeouts late
 * in a half, and replay reviews. Overtime is 10 minutes, sudden death.
 */
const PERIOD = 900;
const OT = 600;
const WALL = {
  tv: [120, 150],
  twominute: [140, 165],
  quarter: [120, 150],
  halftime: [760, 800],
  overtime: [170, 190],
  timeout: [60, 85],
  review: [80, 120],
} as const;

export function simulateNfl(info: GameInfo, opts: SimOptions): FeedEvent[] {
  const rng: Rng = makeRng(opts.seed);
  const homeEdge = opts.homeEdge ?? between(rng, -0.08, 0.1); // extra yards per play, as a share
  const events: FeedEvent[] = [];
  const score = { home: 0, away: 0 };
  let timeouts = { home: 3, away: 3 };
  let t = info.scheduledStart;
  let period = 1;
  let clock = PERIOD;
  let seq = 0;
  let poss: Side = rng() < 0.5 ? 'home' : 'away';
  const receivesSecondHalf: Side = poss === 'home' ? 'away' : 'home';
  let yard = 25; // offense's distance from its own goal line (100 = touchdown)
  let down = 1;
  let toGo = 10;
  const twoMinDone = new Set<number>();
  let over = false;

  const code = (s: Side) => (s === 'home' ? info.home.code : info.away.code);
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
  const wall = (k: keyof typeof WALL) => between(rng, WALL[k][0], WALL[k][1]) * 1000;
  const fieldLabel = () => (yard === 50 ? 'midfield' : yard < 50 ? `own ${yard}` : `opp ${100 - yard}`);

  const emit = (type: FeedEventType, text: string, extra: Partial<FeedEvent> = {}, running = true) => {
    events.push({
      gameId: info.id,
      seq: seq++,
      t: Math.round(t),
      type,
      period,
      clock: Math.max(0, Math.round(clock)),
      clockRunning: running,
      homeScore: score.home,
      awayScore: score.away,
      possession: poss,
      fieldPos: Math.max(1, Math.min(99, yard)),
      text,
      ...extra,
    });
  };

  const stoppage = (type: FeedEventType, text: string, k: keyof typeof WALL, extra: Partial<FeedEvent> = {}) => {
    emit(type, text, extra, false);
    t += wall(k);
    emit('resume', 'Play resumes', {}, false);
  };

  const newDrive = (side: Side, startYard: number) => {
    poss = side;
    yard = startYard;
    down = 1;
    toGo = 10;
  };

  /** Kickoff after a score or to start a half: the kicking team is `kicker`. */
  const kickoff = (kicker: Side) => {
    t += between(rng, 20, 30) * 1000;
    newDrive(other(kicker), rng() < 0.6 ? 25 : Math.round(between(rng, 15, 40)));
    emit('kickoff', `${code(kicker)} kicks off; ${code(poss)} ball at the ${fieldLabel()}`, {}, false);
    if (rng() < 0.35) stoppage('mandatory_timeout', 'TV timeout', 'tv');
  };

  const scored = (side: Side, pts: number, text: string) => {
    score[side] += pts;
    emit('score', text, { team: side, points: pts }, false);
    if (period >= 5) {
      over = true;
      emit('game_end', `Final (OT): ${info.away.code} ${score.away}, ${info.home.code} ${score.home}`, {}, false);
      return;
    }
    stoppage('mandatory_timeout', 'TV timeout', 'tv');
    kickoff(side);
  };

  /** Clock reaches 0: end the quarter, half or game. Returns false when the game is over. */
  const endPeriod = (): boolean => {
    clock = 0;
    emit('period_end', `End of ${period <= 4 ? `Q${period}` : 'OT'}`, {}, false);
    if (period >= 4 && (score.home !== score.away || period >= 5)) {
      emit('game_end', `Final${period >= 5 ? ' (OT)' : ''}: ${info.away.code} ${score.away}, ${info.home.code} ${score.home}`, {}, false);
      return false;
    }
    t += wall(period === 2 ? 'halftime' : period >= 4 ? 'overtime' : 'quarter');
    period++;
    clock = period <= 4 ? PERIOD : OT;
    emit('period_start', `Start of ${period <= 4 ? `Q${period}` : 'OT'}`, {}, true);
    if (period === 3 || period === 5) {
      timeouts = { home: 3, away: 3 };
      kickoff(period === 3 ? other(receivesSecondHalf) : rng() < 0.5 ? 'home' : 'away');
    }
    return true;
  };

  emit('tipoff', `Kickoff: ${info.away.city} at ${info.home.city}`, {}, true);
  kickoff(other(poss));

  while (!over) {
    if (clock <= 0) {
      if (!endPeriod()) break;
      continue;
    }

    // Two-minute warning.
    if ((period === 2 || period === 4) && clock <= 120 && !twoMinDone.has(period)) {
      twoMinDone.add(period);
      clock = 120;
      stoppage('two_minute_warning', 'Two-minute warning', 'twominute');
      continue;
    }

    const margin = (score[poss] - score[other(poss)]) * 1;
    const lateHalf = (period === 2 || period >= 4) && clock < 240;
    const hurry = lateHalf && (period === 2 || margin < 0);
    const milk = period >= 4 && clock < 360 && margin > 0;

    // Fourth down: punt, kick or go for it.
    if (down === 4) {
      const fgDist = 100 - yard + 17;
      const desperate = period >= 4 && clock < 150 && margin < 0 && (margin < -3 || fgDist > 50);
      if (!desperate && fgDist <= 55 && (toGo > 2 || yard > 70 || (period >= 4 && margin >= -3 && margin <= 0))) {
        t += between(rng, 30, 40) * 1000;
        clock -= 5;
        const pMake = Math.max(0.25, Math.min(0.97, 1.25 - fgDist * 0.012));
        if (rng() < pMake) {
          scored(poss, 3, `${code(poss)} ${fgDist}-yard field goal is good`);
        } else {
          emit('play', `${code(poss)} ${fgDist}-yard field goal is no good`, {}, false);
          newDrive(other(poss), Math.max(20, 100 - yard - 7));
        }
        continue;
      }
      if (!desperate && !(toGo <= 1 && yard > 45 && rng() < 0.5)) {
        t += between(rng, 30, 40) * 1000;
        clock -= milk ? 8 : 10;
        const net = Math.round(between(rng, 35, 50));
        const kicker = poss;
        newDrive(other(poss), Math.max(5, Math.min(40, 100 - (yard + net))));
        emit('play', `${code(kicker)} punts; ${code(poss)} ball at the ${fieldLabel()}`, {}, !lateHalf);
        if (rng() < 0.25) stoppage('mandatory_timeout', 'TV timeout', 'tv');
        continue;
      }
    }

    // A snap.
    const edge = (poss === 'home' ? homeEdge : -homeEdge) + (margin < -7 && period >= 3 ? 0.08 : 0);
    const pass = hurry || rng() < 0.55;
    const outcome = weighted(rng, [
      ['loss', pass ? 0.08 : 0.12],
      ['short', pass ? 0.25 : 0.5],
      ['medium', pass ? 0.22 : 0.25],
      ['big', pass ? 0.08 + edge * 0.3 : 0.05 + edge * 0.2],
      ['incomplete', pass ? 0.34 : 0],
      ['turnover', pass ? 0.03 : 0.012],
    ] as const);
    let gain = 0;
    if (outcome === 'loss') gain = -Math.round(between(rng, 1, 7));
    else if (outcome === 'short') gain = Math.round(between(rng, 0, 5));
    else if (outcome === 'medium') gain = Math.round(between(rng, 5, 14));
    else if (outcome === 'big') gain = Math.round(between(rng, 15, 45));
    const stopsClock = outcome === 'incomplete' || (hurry && rng() < 0.6) || outcome === 'turnover';
    const playSecs = between(rng, 4, 8);
    const between_ = stopsClock ? 0 : milk ? between(rng, 36, 40) : hurry ? between(rng, 8, 14) : between(rng, 22, 34);
    clock -= playSecs;
    t += (hurry ? between(rng, 20, 28) : between(rng, 33, 44)) * 1000;

    if (outcome === 'turnover') {
      const intercepted = pass;
      const kicker = poss;
      newDrive(other(poss), Math.max(5, Math.min(80, 100 - yard + Math.round(between(rng, -10, 15)))));
      emit('turnover', `${intercepted ? 'Intercepted' : 'Fumble'}! ${code(poss)} takes over at the ${fieldLabel()}`, { team: kicker }, false);
      if (rng() < 0.4) stoppage('mandatory_timeout', 'TV timeout', 'tv');
      continue;
    }

    yard += gain;
    if (yard >= 100) {
      const pat = rng() < 0.94;
      scored(poss, pat ? 7 : 6, `${code(poss)} touchdown${pass ? ' pass' : ' run'}${pat ? '' : ' (PAT no good)'}`);
      continue;
    }
    if (yard <= 0) {
      // Safety.
      const def = other(poss);
      score[def] += 2;
      emit('score', `Safety: ${code(def)} 2 points`, { team: def, points: 2 }, false);
      stoppage('mandatory_timeout', 'TV timeout', 'tv');
      newDrive(def, 35);
      emit('play', `${code(other(def))} free kick; ${code(def)} ball at the ${fieldLabel()}`, {}, false);
      continue;
    }
    if (gain >= toGo) {
      down = 1;
      toGo = Math.min(10, 100 - yard);
    } else {
      down++;
      toGo -= gain;
      if (down > 4) {
        emit('play', `Turnover on downs at the ${fieldLabel()}`, {}, false);
        newDrive(other(poss), 100 - yard);
        continue;
      }
    }
    const what = outcome === 'incomplete' ? 'incomplete pass' : `${pass ? 'pass' : 'run'} for ${gain} yard${Math.abs(gain) === 1 ? '' : 's'}`;
    emit('play', `${code(poss)} ${what}; ${down}${['', 'st', 'nd', 'rd', 'th'][down]} & ${toGo} at the ${fieldLabel()}`, {}, !stopsClock);
    clock -= between_;

    // Late in a half the defense, if trailing or tied, burns timeouts to save clock.
    const def = other(poss);
    if (lateHalf && !stopsClock && timeouts[def] > 0 && score[def] <= score[poss] && rng() < 0.4) {
      clock += between_ * 0.9; // the timeout saved most of the runoff
      timeouts[def]--;
      stoppage('timeout', `Timeout ${code(def)}`, 'timeout', { team: def });
      continue;
    }
    if (rng() < 0.015) stoppage('review', 'Replay review', 'review');
  }
  return events;
}
