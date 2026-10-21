import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Director } from '../src/director';
import { gameClock, situation } from '../src/explain';
import { initialSnapshot } from '../src/gameState';
import { buildRecap } from '../src/recap';
import { MLB, NFL } from '../src/sports';
import { buildSlate } from '../src/sim/slate';
import { MLB_TEAMS, NFL_TEAMS } from '../src/sim/teams';
import { ReplayLineupSource } from '../src/lineup';
import type { FeedEvent, GameInfo, GameSnapshot } from '../src/types';

const snap = (over: Partial<GameSnapshot>): GameSnapshot => ({ ...initialSnapshot('g'), phase: 'live', ...over });

test('football: late and close beats early, the ball and field position matter', () => {
  const early = NFL.leverage(snap({ period: 1, homeScore: 0, awayScore: 0 }), 900);
  const late = NFL.leverage(snap({ period: 4, homeScore: 20, awayScore: 17, possession: 'away', fieldPos: 30 }), 90);
  const blowout = NFL.leverage(snap({ period: 4, homeScore: 38, awayScore: 10 }), 300);
  assert.ok(early > 0.9 && early < 1.1, `opening kickoff ~1 (${early})`);
  assert.ok(late > 3, `3-pt game, 1:30 left, trailer driving is crunch time (${late})`);
  const oneScore = NFL.leverage(
    snap({ period: 4, homeScore: 27, awayScore: 20, possession: 'away', fieldPos: 50 }),
    120,
  );
  assert.ok(oneScore > 1.6, `one-score game at the two-minute warning is close (${oneScore})`);
  assert.ok(blowout < 0.15);
  const down4 = { period: 4, homeScore: 17, awayScore: 20 } as const;
  const withBall = NFL.homeWinProb(snap({ ...down4, possession: 'home', fieldPos: 85 }), 60);
  const without = NFL.homeWinProb(snap({ ...down4, possession: 'away', fieldPos: 40 }), 60);
  assert.ok(withBall > 0.4 && without < 0.05, `${withBall} vs ${without}`);
});

test('baseball: outs and runners drive win probability; labels read like a broadcast', () => {
  const tiedBot9 = { period: 18, homeScore: 3, awayScore: 3 } as const;
  const loaded = MLB.homeWinProb(snap({ ...tiedBot9, outs: 0, bases: 7 }), 0);
  const empty2 = MLB.homeWinProb(snap({ ...tiedBot9, outs: 2, bases: 0 }), 0);
  assert.ok(loaded > 0.8 && empty2 < loaded, `${loaded} vs ${empty2}`);
  assert.ok(
    MLB.leverage(snap({ period: 18, homeScore: 2, awayScore: 3, outs: 1, bases: 3 }), 0) > 3,
    'down one in the bottom of the 9th with runners on is crunch time',
  );
  assert.ok(MLB.leverage(snap({ period: 2, homeScore: 0, awayScore: 0, outs: 0, bases: 0 }), 0) < 1.5);
  assert.equal(MLB.periodLabel(15), 'Top 8th');
  assert.equal(MLB.periodLabel(15, snap({ phase: 'break', breakKind: 'inning', period: 15 })), 'Mid 8th');
  assert.equal(MLB.periodLabel(16, snap({ phase: 'break', breakKind: 'inning', period: 16 })), 'End 8th');
  assert.equal(MLB.clockLabel(snap({ outs: 1 }), 0), '1 out');
});

test('mixed nights: every sport plays, basketball-only nights are unchanged', () => {
  const plain = buildSlate(5);
  assert.deepEqual(buildSlate(5, 8, { sports: ['nba'] }), plain, 'an nba-only list is the same night');
  assert.ok(plain.games.every((g) => g.sport === undefined));

  const mixed = buildSlate(5, 8, { sports: ['nba', 'nfl', 'mlb'] });
  assert.deepEqual(
    mixed.games.map((g) => g.sport),
    ['nba', 'nfl', 'mlb', 'nba', 'nfl', 'mlb', 'nba', 'nfl'],
  );
  assert.deepEqual(buildSlate(5, 8, { sports: ['nba', 'nfl', 'mlb'] }), mixed, 'deterministic');
  for (const g of mixed.games) {
    const evs = mixed.events.filter((e) => e.gameId === g.id);
    assert.equal(evs[evs.length - 1].type, 'game_end', `${g.id} (${g.sport}) ends`);
  }
  const codes = mixed.games.flatMap((g) => [g.home.code, g.away.code]);
  assert.equal(new Set(codes).size, codes.length, 'no team plays twice');
});

test("mixed nights: the director hops on each sport's own breaks and labels them", () => {
  const slate = buildSlate(45, 8, { sports: ['nba', 'nfl', 'mlb'] });
  const src = new ReplayLineupSource(slate);
  const d = new Director(src.games(), { favorites: ['MEM'], likes: [], loyalty: 'team-first', multiview: true });
  const titles = new Set<string>();
  let prev = 0;
  for (let t = 0; t <= slate.endsAt; t += 2000) {
    d.ingestAll(src.poll(prev, t));
    prev = t;
    const v = d.tick(t);
    for (const x of v.decisions.filter((x) => x.t === t)) titles.add(x.title.replace(/ in .*/, ''));
    for (const g of v.insights) {
      const [period, clock] = gameClock(g);
      assert.ok(period.length > 0 && !/NaN|undefined/.test(period + clock + situation(g)), `${period} ${clock}`);
    }
  }
  for (const k of ['TV timeout', 'Inning break', 'Media timeout']) assert.ok(titles.has(k), `hopped on a ${k}`);
});

test('recaps speak each sport: runs in baseball, unanswered points in football', () => {
  const info = (sport: 'nfl' | 'mlb'): GameInfo => ({
    id: 'g',
    home: (sport === 'nfl' ? NFL_TEAMS : MLB_TEAMS)[0],
    away: (sport === 'nfl' ? NFL_TEAMS : MLB_TEAMS)[1],
    channel: { id: 'c', number: 1, name: 'c', delayMs: 0 },
    scheduledStart: 0,
    sport,
  });
  const ev = (seq: number, team: 'home' | 'away', points: number, home: number, away: number): FeedEvent => ({
    gameId: 'g',
    seq,
    t: seq * 60_000,
    type: 'score',
    period: 1,
    clock: 0,
    clockRunning: false,
    homeScore: home,
    awayScore: away,
    team,
    points,
    text: 'score',
  });
  const mlb = buildRecap(info('mlb'), [ev(1, 'away', 1, 2, 1), ev(2, 'away', 2, 2, 3)], 600_000, false);
  assert.match(mlb!.text, /run/);
  const nfl = buildRecap(
    info('nfl'),
    [ev(1, 'away', 7, 10, 7), ev(2, 'away', 7, 10, 14), ev(3, 'away', 3, 10, 17)],
    900_000,
    false,
  );
  assert.match(nfl!.text, /point/);
  assert.doesNotMatch(nfl!.text, /–0 run/);
});
