import { between, makeRng, weighted, type Rng } from '../rng';
import { ordinal } from '../sports/sport';
import type { FeedEvent, FeedEventType, GameInfo, Side } from '../types';
import type { SimOptions } from './simulateGame';

/**
 * Plate-appearance baseball simulator: outs, walks, hits and home runs with
 * realistic rates, runners advancing, double plays and sacrifice flies. Stoppages
 * are the ones a broadcast has: the break between every half-inning, mid-inning
 * pitching changes (late, with runners on) and the odd replay review. Extra innings
 * start with a runner on second; the home team walks off when it takes the lead in
 * the 9th or later.
 */
const WALL = {
  pa: [70, 130],
  inning: [125, 145],
  pitching: [130, 150],
  review: [50, 90],
} as const;

export function simulateMlb(info: GameInfo, opts: SimOptions): FeedEvent[] {
  const rng: Rng = makeRng(opts.seed);
  const homeEdge = opts.homeEdge ?? between(rng, -0.025, 0.035); // on-base edge per PA
  const events: FeedEvent[] = [];
  const score = { home: 0, away: 0 };
  let t = info.scheduledStart;
  let half = 1;
  let outs = 0;
  let bases = 0;
  let seq = 0;
  let changesThisHalf = 0;

  const inning = () => Math.ceil(half / 2);
  const batting = (): Side => (half % 2 === 1 ? 'away' : 'home');
  const code = (s: Side) => (s === 'home' ? info.home.code : info.away.code);
  const wall = (k: keyof typeof WALL) => between(rng, WALL[k][0], WALL[k][1]) * 1000;
  const halfName = () => `${half % 2 === 1 ? 'Top' : 'Bottom'} of the ${ordinal(inning())}`;

  const emit = (type: FeedEventType, text: string, extra: Partial<FeedEvent> = {}) => {
    events.push({
      gameId: info.id,
      seq: seq++,
      t: Math.round(t),
      type,
      period: half,
      clock: 0,
      clockRunning: false,
      homeScore: score.home,
      awayScore: score.away,
      outs,
      bases,
      text,
      ...extra,
    });
  };

  const stoppage = (type: FeedEventType, text: string, k: keyof typeof WALL) => {
    emit(type, text);
    t += wall(k);
    emit('resume', 'Play resumes');
  };

  /** Runners advance `n` bases (batter included when `batter`), returns runs scored. */
  const advance = (n: number, batter: boolean): number => {
    let runs = 0;
    let next = 0;
    for (const b of [4, 2, 1]) {
      if (!(bases & b)) continue;
      const pos = b === 4 ? 3 : b === 2 ? 2 : 1;
      const to = pos + n;
      if (to >= 4) runs++;
      else next |= 1 << (to - 1);
    }
    if (batter) {
      if (n >= 4) runs++;
      else next |= 1 << (n - 1);
    }
    bases = next;
    return runs;
  };

  /** Walk: only forced runners move. */
  const walk = (): number => {
    if (bases === 7) return 1;
    if (!(bases & 1)) bases |= 1;
    else if (!(bases & 2)) bases |= 3;
    else bases |= 7;
    return 0;
  };

  emit('tipoff', `First pitch: ${info.away.city} at ${info.home.city}`);

  for (;;) {
    t += wall('pa');
    const side = batting();
    const late = inning() >= 6;

    if (late && bases && changesThisHalf < 1 && rng() < 0.07) {
      changesThisHalf++;
      stoppage('pitching_change', `Pitching change for ${code(side === 'home' ? 'away' : 'home')}`, 'pitching');
    }

    const edge = side === 'home' ? homeEdge : -homeEdge;
    const outcome = weighted(rng, [
      ['strikeout', 0.225],
      ['out', 0.455 - edge],
      ['walk', 0.09],
      ['single', 0.145 + edge * 0.6],
      ['double', 0.045 + edge * 0.2],
      ['triple', 0.004],
      ['homer', 0.032 + edge * 0.2],
    ] as const);

    let runs = 0;
    let text = '';
    switch (outcome) {
      case 'strikeout':
        outs++;
        text = `${code(side)} strikeout`;
        break;
      case 'out': {
        if (bases & 1 && outs < 2 && rng() < 0.12) {
          outs += 2;
          bases &= ~1;
          text = `${code(side)} grounds into a double play`;
        } else if (bases & 4 && outs < 2 && rng() < 0.3) {
          outs++;
          bases &= ~4;
          runs = 1;
          text = `${code(side)} sacrifice fly, run scores`;
        } else {
          outs++;
          text = `${code(side)} ${rng() < 0.5 ? 'grounds out' : 'flies out'}`;
        }
        break;
      }
      case 'walk':
        runs = walk();
        text = `${code(side)} walk`;
        break;
      case 'single': {
        const fromSecond = bases & 2 && rng() < 0.6;
        runs = advance(1, true);
        if (fromSecond && bases & 4) {
          bases &= ~4;
          runs++;
        }
        text = `${code(side)} single`;
        break;
      }
      case 'double':
        runs = advance(2, true);
        if (bases & 4 && rng() < 0.4) {
          bases &= ~4;
          runs++;
        }
        text = `${code(side)} double`;
        break;
      case 'triple':
        runs = advance(3, true);
        text = `${code(side)} triple`;
        break;
      case 'homer':
        runs = advance(4, true);
        text =
          runs >= 4 ? `${code(side)} grand slam!` : `${code(side)} ${runs > 1 ? `${runs}-run homer` : 'solo homer'}`;
        break;
    }
    if (outs >= 3) {
      outs = 3;
      bases = 0;
    }
    if (runs > 0) {
      score[side] += runs;
      emit('score', `${text}${runs > 1 && outcome !== 'homer' ? `, ${runs} runs score` : ''}`, {
        team: side,
        points: runs,
      });
    } else emit('play', text);

    // Walk-off.
    if (side === 'home' && inning() >= 9 && score.home > score.away) {
      emit('game_end', `Walk-off! Final: ${info.away.code} ${score.away}, ${info.home.code} ${score.home}`);
      return events;
    }

    if (outs >= 3) {
      emit('period_end', `End of the ${halfName().toLowerCase()}`);
      const endOfTop = half % 2 === 1;
      if (inning() >= 9 && ((endOfTop && score.home > score.away) || (!endOfTop && score.home !== score.away))) {
        emit(
          'game_end',
          `Final${inning() > 9 ? ` (${inning()})` : ''}: ${info.away.code} ${score.away}, ${info.home.code} ${score.home}`,
        );
        return events;
      }
      t += wall('inning');
      half++;
      outs = 0;
      bases = inning() >= 10 ? 2 : 0; // extra innings: runner on second
      changesThisHalf = 0;
      emit('period_start', halfName());
    } else if (rng() < 0.008) {
      stoppage('review', 'Replay review', 'review');
    }
  }
}
