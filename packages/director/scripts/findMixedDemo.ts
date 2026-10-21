/**
 * Find the best 3-sport demo: a (night, favorite team, start time) where a ~3-minute
 * recording at 8x shows basketball, football and baseball on screen, a split or
 * three-up mixing sports, a break hop and a return to your team, and your team in
 * a close finish, without short-lived screens.
 *   tsx scripts/findMixedDemo.ts [fromSeed] [toSeed] [realSeconds=150] [speed=8]
 */
import { Director, buildSlate, ReplayLineupSource, type DirectorView, type SportId } from '../src';

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? 80);
const realSec = Number(process.argv[4] ?? 150);
const speed = Number(process.argv[5] ?? 8);
const SPORTS: SportId[] = ['nba', 'nfl', 'mlb'];
const STEP = 2000;

interface Frame {
  t: number;
  view: DirectorView;
  sports: Set<string>;
}

const rows: Array<Record<string, number | string>> = [];
for (let seed = from; seed <= to; seed++) {
  const slate = buildSlate(seed, 8, { sports: SPORTS });
  const finals = new Map(slate.games.map((g) => [g.id, slate.events.filter((e) => e.gameId === g.id).pop()!]));
  for (const g of slate.games) {
    const f = finals.get(g.id)!;
    const margin = Math.abs(f.homeScore - f.awayScore);
    if (margin > (g.sport === 'mlb' ? 1 : g.sport === 'nfl' ? 7 : 5)) continue; // your team in a close one
    const fav = g.home.code;
    const src = new ReplayLineupSource(slate);
    const d = new Director(src.games(), { favorites: [fav], likes: [], loyalty: 'team-first', multiview: true });
    const sportOfId = new Map(slate.games.map((x) => [x.id, x.sport ?? 'nba']));
    const frames: Frame[] = [];
    let prev = 0;
    for (let t = 0; t <= slate.endsAt; t += STEP) {
      d.ingestAll(src.poll(prev, t));
      prev = t;
      const view = d.tick(t);
      frames.push({ t, view, sports: new Set(view.slots.map((id) => sportOfId.get(id)!)) });
    }
    const win = (realSec * speed * 1000) / STEP;
    for (let i = 0; i + win < frames.length; i += 30) {
      const w = frames.slice(i, i + win);
      const seen = new Set<string>();
      let mixedMulti = 0;
      let threeSportMulti = 0;
      let big = 0;
      let favCrunch = 0;
      let changes = 0;
      let short = 0;
      let lastChange = w[0].t;
      let prevKey = '';
      for (const fr of w) {
        fr.sports.forEach((s) => seen.add(s));
        if (fr.view.layout !== 'single' && fr.sports.size >= 2) mixedMulti++;
        if (fr.sports.size >= 3) threeSportMulti++;
        if (fr.view.layout === 'trio' || fr.view.layout === 'quad') big++;
        const favTile = fr.view.insights.find((x) => fr.view.slots.includes(x.info.id) && x.tags.includes('favorite'));
        if (favTile && (favTile.tags.includes('crunch') || favTile.tags.includes('overtime'))) favCrunch++;
        const key = `${fr.view.layout}:${[...fr.view.slots].sort().join(',')}`;
        if (prevKey && key !== prevKey) {
          changes++;
          if (fr.t - lastChange < 60_000) short++;
          lastChange = fr.t;
        }
        prevKey = key;
      }
      if (seen.size < 3) continue;
      const t0 = w[0].t;
      const t1 = w[w.length - 1].t;
      const kinds = w[w.length - 1].view.decisions.filter((x) => x.t > t0 && x.t <= t1).map((x) => x.kind);
      const hops = kinds.filter((k) => k === 'break-hop').length;
      const returns = kinds.filter((k) => k === 'return').length;
      if (!hops || !returns) continue;
      const favFinalInWindow = f.t + g.channel.delayMs <= t1 && f.t + g.channel.delayMs > t0 ? 1 : 0;
      const score =
        mixedMulti * 2 +
        threeSportMulti * 4 +
        big * 2 +
        favCrunch * 3 +
        favFinalInWindow * 40 +
        Math.min(hops, 3) * 10 +
        Math.min(returns, 2) * 10 -
        short * 25 -
        Math.max(0, changes - 14) * 5;
      rows.push({
        seed,
        fav,
        sport: g.sport ?? 'nba',
        startSec: Math.round(t0 / 1000),
        mixedMulti,
        threeSportMulti,
        big,
        favCrunch,
        favFinal: favFinalInWindow,
        hops,
        returns,
        changes,
        short,
        score,
      });
    }
  }
}
// Best window per (seed, fav).
const best = new Map<string, Record<string, number | string>>();
for (const r of rows) {
  const k = `${r.seed}:${r.fav}`;
  if (!best.has(k) || (best.get(k)!.score as number) < (r.score as number)) best.set(k, r);
}
console.table([...best.values()].sort((a, b) => (b.score as number) - (a.score as number)).slice(0, 15));
