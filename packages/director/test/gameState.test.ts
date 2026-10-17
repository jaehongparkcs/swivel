import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameTimeline } from '../src/gameState';
import { feed } from './helpers';

test('timeouts, resume, quarter breaks and final are reduced correctly', () => {
  const ev = feed('g1');
  const tl = new GameTimeline('g1');
  [
    ev(0, 'tipoff', 1, 720, 0, 0),
    ev(20, 'score', 1, 700, 2, 0, { team: 'home', points: 2 }),
    ev(30, 'timeout', 1, 690, 2, 0, { team: 'away' }),
    ev(180, 'resume', 1, 690, 2, 0),
    ev(900, 'period_end', 1, 0, 20, 18),
    ev(1035, 'period_start', 2, 720, 20, 18),
    ev(5000, 'game_end', 4, 0, 100, 98),
  ].forEach((e) => tl.push(e));
  assert.equal(tl.snapshotAt(10_000).phase, 'live');
  const to = tl.snapshotAt(100_000);
  assert.equal(to.phase, 'break');
  assert.equal(to.breakKind, 'timeout');
  assert.equal(tl.snapshotAt(200_000).phase, 'live');
  assert.equal(tl.snapshotAt(950_000).breakKind, 'quarter');
  assert.equal(tl.snapshotAt(1_100_000).period, 2);
  assert.equal(tl.snapshotAt(6_000_000).phase, 'final');
});

test('mandatory media timeout arms under 7:00 and is satisfied by a team timeout', () => {
  const ev = feed('g1');
  const tl = new GameTimeline('g1');
  tl.push(ev(0, 'tipoff', 1, 720, 0, 0));
  tl.push(ev(300, 'miss', 1, 430, 10, 8));
  assert.equal(tl.snapshotAt(300_000).mandatoryArmed, false);
  tl.push(ev(320, 'rebound', 1, 410, 10, 8));
  assert.equal(tl.snapshotAt(320_000).mandatoryArmed, true);
  tl.push(ev(330, 'timeout', 1, 400, 10, 8, { team: 'home' }));
  tl.push(ev(480, 'resume', 1, 400, 10, 8));
  assert.equal(tl.snapshotAt(480_000).mandatoryArmed, false);
  tl.push(ev(700, 'miss', 1, 170, 22, 20));
  assert.equal(tl.snapshotAt(700_000).mandatoryArmed, true, 'second window under 3:00');
});

test('clock interpolates smoothly toward the next known event', () => {
  const ev = feed('g1');
  const tl = new GameTimeline('g1');
  tl.push(ev(0, 'tipoff', 1, 720, 0, 0));
  tl.push(ev(10, 'foul', 1, 710, 0, 0));
  tl.push(ev(40, 'score', 1, 700, 2, 0, { team: 'home', points: 2 })); // 20s dead ball, then 10s of play
  assert.equal(tl.clockAt(5_000), 715);
  assert.equal(tl.clockAt(20_000), 710, 'clock stopped during free throws');
  assert.equal(tl.clockAt(35_000), 705);
});

test('duplicate and stale deliveries are ignored', () => {
  const ev = feed('g1');
  const tl = new GameTimeline('g1');
  const a = ev(0, 'tipoff', 1, 720, 0, 0);
  tl.push(a);
  tl.push(a);
  assert.equal(tl.size, 1);
});
