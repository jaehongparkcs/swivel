import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Director } from '../src/director';
import { buildSlate } from '../src/sim/slate';
import { ReplayLineupSource } from '../src/lineup';
import type { FeedEvent } from '../src/types';
import { feed, game } from './helpers';

const prefs = { favorites: [] as string[], likes: [] as string[], loyalty: 'balanced' as const, multiview: true };

function run(d: Director, events: FeedEvent[], untilSec: number, stepSec = 1) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let i = 0;
  let view = d.tick(0);
  for (let t = 0; t <= untilSec * 1000; t += stepSec * 1000) {
    while (i < sorted.length && sorted[i].t <= t) d.ingest(sorted[i++]);
    view = d.tick(t);
  }
  return view;
}

test('hops on a timeout and returns when play resumes', () => {
  const A = game('A', 0);
  const B = game('B', 1);
  const a = feed('A');
  const b = feed('B');
  const d = new Director([A, B], { ...prefs, favorites: [A.home.code] });
  const events = [
    a(0, 'tipoff', 1, 720, 0, 0),
    b(0, 'tipoff', 1, 720, 0, 0),
    a(60, 'score', 1, 660, 2, 0, { team: 'home', points: 2 }),
    b(60, 'score', 1, 660, 0, 2, { team: 'away', points: 2 }),
    a(100, 'timeout', 1, 640, 2, 0, { team: 'away' }),
    a(250, 'resume', 1, 640, 2, 0),
    b(400, 'score', 1, 400, 2, 2, { team: 'home', points: 2 }),
  ];
  let v = run(d, events, 50);
  assert.deepEqual(v.slots, ['A'], 'starts on the favorite');
  v = run(d, events.filter((e) => e.t > 50_000), 120);
  assert.deepEqual(v.slots, ['B'], 'hopped during the timeout');
  assert.equal(v.returnTo, 'A');
  assert.equal(v.decisions[v.decisions.length - 1].kind, 'break-hop');
  v = run(d, events.filter((e) => e.t > 120_000), 260);
  assert.deepEqual(v.slots, ['A'], 'came back');
  assert.equal(v.decisions[v.decisions.length - 1].kind, 'return');
});

test('tuning in while your team is on a break: "your team is back on", not "taking you back"', () => {
  const A = game('A', 0);
  const B = game('B', 1);
  const a = feed('A');
  const b = feed('B');
  const d = new Director([A, B], { ...prefs, favorites: [A.home.code] });
  const events = [
    a(0, 'tipoff', 1, 720, 0, 0),
    b(0, 'tipoff', 1, 720, 0, 0),
    a(10, 'timeout', 1, 710, 0, 0, { team: 'away' }),
    a(200, 'resume', 1, 710, 0, 0),
  ];
  for (const e of events.filter((e) => e.t <= 20_000)) d.ingest(e);
  let v = d.tick(20_000);
  assert.deepEqual(v.slots, ['B'], 'starts on the live game');
  assert.equal(v.returnTo, 'A');
  for (const e of events.filter((e) => e.t > 20_000)) d.ingest(e);
  for (let t = 21_000; t <= 210_000; t += 1000) v = d.tick(t);
  assert.deepEqual(v.slots, ['A'], 'brought to your team');
  const last = v.decisions[v.decisions.length - 1];
  assert.equal(last.kind, 'return');
  assert.equal(last.title, 'Your team is back on');
  assert.ok(!/Taking you back/.test(last.detail));
});

test('uses feed lookahead: never switches into a game whose break is about to hit the stream', () => {
  const A = game('A', 0, 0);
  const B = game('B', 1, 40_000); // B's video lags its feed by 40s
  const C = game('C', 2, 0);
  const a = feed('A');
  const b = feed('B');
  const c = feed('C');
  const d = new Director([A, B, C], { ...prefs, favorites: [A.home.code], likes: [B.home.code] });
  const events = [
    a(0, 'tipoff', 1, 720, 0, 0),
    b(0, 'tipoff', 1, 720, 0, 0),
    c(0, 'tipoff', 1, 720, 0, 0),
    b(95, 'timeout', 1, 625, 4, 4, { team: 'home' }), // on B's screen at t=135
    a(100, 'timeout', 1, 620, 2, 0, { team: 'away' }),
  ];
  const v = run(d, events, 105);
  assert.deepEqual(v.slots, ['C'], 'skipped B even though it ranks higher, its timeout is 30s away on screen');
  const bi = v.insights.find((g) => g.info.id === 'B')!;
  assert.ok(bi.breakIncomingInMs! > 25_000 && bi.breakIncomingInMs! < 35_000);
});

test('no thrashing: dwell time and hysteresis cap opportunistic switches', () => {
  const slate = buildSlate(11);
  const src = new ReplayLineupSource(slate);
  const d = new Director(src.games(), prefs);
  let prev = 0;
  let view = d.tick(0);
  for (let t = 0; t <= slate.endsAt; t += 1000) {
    d.ingestAll(src.poll(prev, t));
    prev = t;
    view = d.tick(t);
  }
  const ups = view.decisions.filter((x) => x.kind === 'upgrade');
  for (let i = 1; i < ups.length; i++) assert.ok(ups[i].t - ups[i - 1].t >= 120_000, 'upgrades respect min dwell');
  // No layout ping-pong faster than the minimum layout time when shrinking.
  const layoutChanges = view.decisions.filter((x) => x.kind === 'multiview-on' || x.kind === 'multiview-off');
  for (let i = 1; i < layoutChanges.length; i++) {
    if (layoutChanges[i].kind === 'multiview-off') assert.ok(layoutChanges[i].t - layoutChanges[i - 1].t >= 30_000);
  }
});

test('two crunch-time games split the screen; a timeout keeps its tile, a quarter break takes it off', () => {
  const A = game('A', 0);
  const B = game('B', 1);
  const C = game('C', 2);
  const [a, b, c] = [feed('A'), feed('B'), feed('C')];
  const d = new Director([A, B, C], prefs);
  const events = [
    a(0, 'period_start', 4, 200, 100, 99),
    b(0, 'period_start', 4, 200, 90, 90),
    c(0, 'period_start', 4, 200, 120, 90),
    a(20, 'score', 4, 180, 100, 101, { team: 'away', points: 2 }),
    b(20, 'score', 4, 180, 92, 90, { team: 'home', points: 2 }),
    c(20, 'score', 4, 180, 122, 90, { team: 'home', points: 2 }),
    a(40, 'timeout', 4, 170, 100, 101, { team: 'home' }),
    a(150, 'resume', 4, 170, 100, 101),
  ];
  let v = run(d, events.filter((e) => e.t <= 35_000), 35);
  assert.equal(v.layout, 'split');
  assert.deepEqual([...v.slots].sort(), ['A', 'B']);
  assert.ok(!v.slots.includes('C'), 'blowout stays off screen');

  v = run(d, events.filter((e) => e.t > 35_000 && e.t <= 60_000), 60);
  assert.equal(v.layout, 'split', 'a timeout does not tear the grid down');
  assert.equal(v.audio, 'B', 'audio moves to the game with action');
  assert.equal(v.insights.find((g) => g.info.id === 'A')!.screen.phase, 'break');

  v = run(d, events.filter((e) => e.t > 60_000), 170);
  assert.equal(v.layout, 'split', 'still split when play resumes');
  assert.deepEqual([...v.slots].sort(), ['A', 'B']);
  assert.ok(!v.decisions.some((x) => x.kind === 'multiview-off'), 'never collapsed');

  // A quarter break is long: that game leaves the grid.
  const q = run(d, [feed('A')(1, 'period_end', 4, 0, 100, 101)].map((e) => ({ ...e, seq: 99, t: 175_000 })), 200);
  assert.equal(q.layout, 'single');
  assert.deepEqual(q.slots, ['B']);
});

test('team first: your team is preferred over a closer game and always gets audio', () => {
  const A = game('A', 0);
  const B = game('B', 1);
  const [a, b] = [feed('A'), feed('B')];
  const d = new Director([A, B], { ...prefs, favorites: [A.home.code], loyalty: 'team-first' });
  const events = [
    a(0, 'period_start', 3, 600, 70, 64), // your team, 6-pt game in the 3rd
    b(0, 'period_start', 4, 300, 88, 88), // tied 4th quarter elsewhere
    a(30, 'timeout', 3, 580, 70, 64, { team: 'away' }),
    a(200, 'resume', 3, 580, 70, 64),
  ];
  let v = run(d, events.filter((e) => e.t <= 20_000), 20);
  assert.equal(v.slots[0], 'A', 'your team gets the big tile');
  assert.equal(v.audio, 'A');
  v = run(d, events.filter((e) => e.t > 20_000 && e.t <= 60_000), 60);
  assert.deepEqual(v.slots, ['A', 'B'], 'your team keeps its tile through the timeout');
  assert.equal(v.audio, 'B', 'audio follows the game with action');
  v = run(d, events.filter((e) => e.t > 60_000), 210);
  assert.equal(v.audio, 'A', 'back to your team, even though the other game is tighter');
});

test('honest countdown: resume is known from the feed before the stream shows it', () => {
  const A = game('A', 0, 30_000);
  const a = feed('A');
  const d = new Director([A], prefs);
  const v = run(d, [a(0, 'tipoff', 1, 720, 0, 0), a(10, 'timeout', 1, 710, 0, 0, { team: 'home' }), a(100, 'resume', 1, 710, 0, 0)], 110);
  const g = v.insights[0];
  assert.equal(g.screen.phase, 'break');
  assert.equal(g.resumeIncomingInMs, 20_000, 'feed resumed at 100s, stream (30s behind) at 130s');
});

test('locking stops all automatic moves', () => {
  const A = game('A', 0);
  const B = game('B', 1);
  const [a, b] = [feed('A'), feed('B')];
  const d = new Director([A, B], { ...prefs, favorites: [A.home.code] });
  run(d, [a(0, 'tipoff', 1, 720, 0, 0), b(0, 'tipoff', 1, 720, 0, 0)], 5);
  d.toggleLock(5000);
  const v = run(d, [a(10, 'timeout', 1, 700, 0, 0, { team: 'home' })], 30);
  assert.deepEqual(v.slots, ['A']);
  assert.equal(v.locked, true);
});

test('slates are deterministic', () => {
  const x = buildSlate(5);
  const y = buildSlate(5);
  assert.equal(x.events.length, y.events.length);
  assert.deepEqual(x.events.slice(-3), y.events.slice(-3));
});

test('optional resume-report lag: resumes land 5–15 s late, nothing else moves', () => {
  const x = buildSlate(5);
  const y = buildSlate(5, 8, { resumeLagMs: [5000, 15_000] });
  assert.equal(x.events.length, y.events.length);
  const key = (e: FeedEvent) => `${e.gameId}:${e.seq}`;
  const lagged = new Map(y.events.map((e) => [key(e), e]));
  let late = 0;
  for (const e of x.events) {
    const l = lagged.get(key(e))!;
    if (e.type !== 'resume') assert.equal(l.t, e.t);
    else {
      assert.ok(l.t >= e.t && l.t <= e.t + 15_000);
      if (l.t >= e.t + 5000) late++;
    }
  }
  assert.ok(late > 0);
  // Per game, the feed stays in order.
  for (const g of y.games) {
    const ts = y.events.filter((e) => e.gameId === g.id).map((e) => e.t);
    assert.ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]));
  }
});

test('seamless: no hop when the feed already shows play resuming within seconds', () => {
  const A = game('A', 0, 40_000); // stream runs 40s behind the feed
  const B = game('B', 1, 40_000);
  const [a, b] = [feed('A'), feed('B')];
  const d = new Director([A, B], { ...prefs, favorites: [A.home.code], multiview: false });
  const events = [
    a(0, 'tipoff', 1, 720, 0, 0),
    b(0, 'tipoff', 1, 720, 0, 0),
    a(100, 'timeout', 1, 640, 2, 0, { team: 'away' }), // on screen at 140
    a(130, 'resume', 1, 640, 2, 0), // a 30 s stoppage, known before the stream shows it
  ];
  const sorted = [...events].sort((x, y) => x.t - y.t);
  let i = 0;
  for (let t = 0; t <= 200_000; t += 1000) {
    while (i < sorted.length && sorted[i].t <= t) d.ingest(sorted[i++]);
    const v = d.tick(t);
    assert.deepEqual(v.slots, ['A'], `stayed on A at ${t / 1000}s`);
  }
});
