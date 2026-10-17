/**
 * Search seeds for a demo-worthy slate: several games in crunch time at once
 * (exercises split/quad), plus overtime. Prints the best seeds.
 *   tsx scripts/findSlate.ts [from] [to]
 */
import { Director, buildSlate, ReplayLineupSource } from '../src';

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? 200);
const rows: Array<{ seed: number; score: number; quad: number; split: number; ot: number; avgPts: number; switches: number }> = [];

for (let seed = from; seed <= to; seed++) {
  const slate = buildSlate(seed);
  const src = new ReplayLineupSource(slate);
  const d = new Director(src.games(), { favorites: [], likes: [], loyalty: 'balanced', multiview: true });
  let prev = 0;
  let quad = 0;
  let split = 0;
  let last;
  for (let t = 0; t <= slate.endsAt; t += 2000) {
    d.ingestAll(src.poll(prev, t));
    prev = t;
    last = d.tick(t);
    if (last.layout === 'quad') quad += 2;
    if (last.layout === 'split') split += 2;
  }
  const finals = slate.games.map((g) => slate.events.filter((e) => e.gameId === g.id).pop()!);
  const ot = finals.filter((e) => e.period > 4).length;
  const avgPts = finals.reduce((s, e) => s + e.homeScore + e.awayScore, 0) / finals.length / 2;
  const switches = last!.decisions.length;
  rows.push({ seed, score: quad * 3 + split + ot * 400, quad, split, ot, avgPts: Math.round(avgPts), switches });
}
rows.sort((a, b) => b.score - a.score);
console.table(rows.slice(0, 12));
const avg = rows.reduce((s, r) => s + r.avgPts, 0) / rows.length;
console.log('mean points per team', avg.toFixed(1), '| slates with split', rows.filter((r) => r.split > 0).length, '/', rows.length, '| with quad', rows.filter((r) => r.quad > 0).length);
