import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeWinProb, leverageIndex, normCdf } from '../src/winprob';

test('normal cdf sanity', () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(normCdf(-1.96) - 0.025) < 1e-3);
});

test('win probability moves the right way', () => {
  assert.ok(homeWinProb(0, 1, 720) > 0.5, 'home edge at tip');
  assert.ok(homeWinProb(10, 4, 60) > 0.99);
  assert.ok(homeWinProb(-10, 4, 60) < 0.01);
  assert.ok(homeWinProb(3, 4, 30) > homeWinProb(3, 2, 30));
  assert.equal(homeWinProb(0, 4, 0), 0.5);
});

test('leverage: opening tip ~1, crunch time high, blowouts near zero', () => {
  assert.ok(Math.abs(leverageIndex(0, 1, 720) - 1) < 0.15);
  assert.ok(leverageIndex(1, 4, 60) > 5, 'one-point game, 1:00 left');
  assert.ok(leverageIndex(2, 4, 180) > 3, 'two-point game, 3:00 left');
  assert.ok(leverageIndex(20, 4, 180) < 0.05, 'blowout');
  assert.ok(leverageIndex(0, 5, 120) > leverageIndex(0, 3, 120), 'overtime > 3rd quarter');
});
