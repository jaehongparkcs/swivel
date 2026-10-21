/**
 * Find a (night, favorite team) pair that makes a strong 3-minute demo:
 * your team in a close finish, break hops and returns, and a three-up or quad moment.
 *   tsx scripts/findDemo.ts [fromSeed] [toSeed]
 */
import { Director, buildSlate, ReplayLineupSource, suggestDemoStart, type SportId } from '../src';

/** SPORTS=nba,nfl,mlb for a mixed night (default: basketball only). */
const SPORTS = process.env.SPORTS ? (process.env.SPORTS.split(',') as SportId[]) : undefined;

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? 120);
const rows: any[] = [];
for (let seed = from; seed <= to; seed++) {
  const slate = buildSlate(seed, 8, { sports: SPORTS });
  const finals = new Map(slate.games.map((g) => [g.id, slate.events.filter((e) => e.gameId === g.id).pop()!]));
  for (const g of slate.games) {
    const f = finals.get(g.id)!;
    const margin = Math.abs(f.homeScore - f.awayScore);
    if (margin > (g.sport === 'mlb' ? 1 : 4)) continue; // your team must be in a close one
    const fav = g.home.code;
    const src = new ReplayLineupSource(slate);
    const d = new Director(src.games(), { favorites: [fav], likes: [], loyalty: 'team-first', multiview: true });
    let prev = 0;
    let big = 0;
    let split = 0;
    let firstBig = -1;
    let view;
    for (let t = 0; t <= slate.endsAt; t += 2000) {
      d.ingestAll(src.poll(prev, t));
      prev = t;
      view = d.tick(t);
      if (view.layout === 'trio' || view.layout === 'quad') {
        big += 2;
        if (firstBig < 0) firstBig = t;
      }
      if (view.layout === 'split') split += 2;
    }
    const kinds = view!.decisions.map((x) => x.kind);
    const ot = f.period > (g.sport === 'mlb' ? 18 : 4) ? 1 : 0;
    rows.push({ seed, fav, sport: g.sport ?? 'nba', ot, margin, big, split, firstBig: firstBig < 0 ? '' : Math.round(firstBig / 1000), returns: kinds.filter((k) => k === 'return').length, score: big * 4 + split + ot * 300 });
  }
}
rows.sort((a, b) => b.score - a.score);
console.table(rows.slice(0, 15));
void suggestDemoStart;
