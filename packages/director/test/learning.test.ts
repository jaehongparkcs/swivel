import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Director } from '../src/director';
import { buildRecap } from '../src/recap';
import { TasteLearner } from '../src/learner';
import type { GameInsight } from '../src/types';
import { feed, game } from './helpers';

const prefs = { favorites: [] as string[], likes: [] as string[], loyalty: 'balanced' as const, multiview: false };

function setup() {
  const A = game('A', 0);
  const B = game('B', 1);
  const [a, b] = [feed('A'), feed('B')];
  const d = new Director([A, B], prefs);
  // Two identical games.
  d.ingestAll([a(0, 'period_start', 2, 600, 40, 38), b(0, 'period_start', 2, 600, 40, 38)]);
  return { d, A, B };
}

test("picking a team's games teaches the director to prefer them", () => {
  const { d, A, B } = setup();
  const before = d.tick(1000).insights.find((g) => g.info.id === 'B')!.watchScore;
  d.manualSelect('B', 2000);
  d.manualSelect('A', 3000);
  d.manualSelect('B', 4000);
  const v = d.tick(5000);
  const after = v.insights.find((g) => g.info.id === 'B')!.watchScore;
  assert.ok(after > before, 'B scores higher after being picked');
  assert.ok(v.learned.likes.includes(B.home.code));
  assert.ok(v.decisions.some((x) => x.kind === 'learned' && x.title.includes(B.home.code)));
  void A;
});

test('skipping a game autopilot chose teaches the director to avoid it', () => {
  const A = game('A', 0);
  const B = game('B', 1);
  const C = game('C', 2);
  const [a, b, c] = [feed('A'), feed('B'), feed('C')];
  const d = new Director([A, B, C], prefs);
  d.ingestAll([
    a(0, 'period_start', 2, 600, 40, 38),
    b(0, 'period_start', 2, 600, 40, 38),
    c(0, 'period_start', 2, 600, 40, 38),
  ]);
  const first = d.tick(1000).audio!;
  d.skip(2000);
  const v = d.tick(3000);
  const skipped = v.insights.find((g) => g.info.id === first)!;
  const others = v.insights.filter((g) => g.info.id !== first);
  assert.ok(d.tasteSnapshot().teams[skipped.info.home.code] < 0);
  assert.ok(
    others.every((g) => g.watchScore > skipped.watchScore),
    'skipped game now ranks last',
  );
  assert.notEqual(v.audio, first);
});

test('holding a game counts as liking it; reset forgets everything', () => {
  const { d } = setup();
  d.manualSelect('A', 1000);
  d.toggleLock(2000);
  d.toggleLock(3000);
  d.toggleLock(4000);
  assert.ok(d.tasteSnapshot().signals >= 3);
  d.resetLearning(5000);
  assert.equal(d.tasteSnapshot().signals, 0);
});

test('recap: a comeback while you were away', () => {
  const A = game('A', 0);
  const a = feed('A');
  const ev = [
    a(0, 'score', 4, 400, 90, 80, { team: 'home', points: 2 }),
    a(30, 'score', 4, 370, 90, 83, { team: 'away', points: 3 }),
    a(60, 'score', 4, 340, 90, 86, { team: 'away', points: 3 }),
    a(90, 'score', 4, 310, 90, 89, { team: 'away', points: 3 }),
    a(120, 'score', 4, 280, 90, 92, { team: 'away', points: 3 }),
  ];
  const r = buildRecap(A, ev, 150_000, false)!;
  assert.ok(r, 'something notable happened');
  assert.match(r.label, /While you were away/);
  assert.match(r.text, new RegExp(`${A.away.code} erased a 8-point deficit on a 12–0 run`));
});

test('recap: nothing to say when you only missed a commercial', () => {
  const A = game('A', 0);
  const a = feed('A');
  assert.equal(
    buildRecap(A, [a(0, 'timeout', 4, 300, 90, 88), a(150, 'resume', 4, 300, 90, 88)], 150_000, false),
    undefined,
  );
});

test('credit leans toward the team you already like, so the opponent learns less', () => {
  const g = (home: string, away: string) =>
    ({
      info: { id: `${away}@${home}`, home: { code: home }, away: { code: away } },
      leverage: 1,
    }) as unknown as GameInsight;
  const fresh = new TasteLearner();
  fresh.onPick(g('TPA', 'HNL'));
  assert.equal(fresh.affinity('TPA'), fresh.affinity('HNL'), 'no history: even split');

  // Keep picking TPA games against different opponents: TPA pulls ahead of each one.
  const l = new TasteLearner();
  l.onPick(g('TPA', 'HNL'));
  l.onPick(g('KCS', 'TPA'));
  l.onPick(g('TPA', 'LVJ'));
  assert.ok(l.affinity('TPA') > l.affinity('LVJ') + 0.1);
  assert.deepEqual(l.learnedLikes(), ['TPA']);

  // An explicit favorite gets the larger share right away; a skip lands mostly on the other team.
  const p = new TasteLearner();
  p.setPrior((c) => (c === 'TPA' ? 1 : 0));
  p.onPick(g('TPA', 'HNL'));
  assert.ok(p.affinity('TPA') > p.affinity('HNL'));
  p.reset();
  p.onSkip(g('TPA', 'HNL'));
  assert.ok(p.affinity('HNL') < p.affinity('TPA'));
});
