/**
 * How seamless is a night? Replays many simulated slates and counts the moments
 * that feel jarring on the couch:
 *  - screen changes per hour (any change of layout or of which games are shown);
 *  - flashes: a game that appears on screen and leaves again within FLASH_MS
 *    (when it leaves for a commercial, that's counted separately as expected);
 *  - short layouts: a layout (split, trio, quad, full) that lasts under FLASH_MS;
 *  - commercial time: share of the night the main tile shows a commercial.
 *
 *   tsx scripts/seamless.ts [nights=40] [firstSeed=1]
 *   MUST_SEE=2.5 tsx scripts/seamless.ts    # try a lower crunch-time bar for multiview
 */
import { Director, buildSlate, isCommercial, ReplayLineupSource, type DirectorView } from '../src';

const nights = Number(process.argv[2] ?? 40);
const firstSeed = Number(process.argv[3] ?? 1);
const FLASH_MS = 60_000;

export interface SeamlessStats {
  hours: number;
  changes: number;
  shortStates: number;
  flashes: number;
  flashesToBreak: number;
  shortLayouts: number;
  commercialMs: number;
  multiMs: number;
  watchedMs: number;
}

export function measure(seed: number): SeamlessStats {
  const slate = buildSlate(seed);
  const src = new ReplayLineupSource(slate);
  const fav = slate.games[seed % slate.games.length].home.code;
  const mustSee = process.env.MUST_SEE ? { mustSeeLeverage: Number(process.env.MUST_SEE) } : {};
  const d = new Director(src.games(), { favorites: [fav], likes: [], loyalty: 'team-first', multiview: true }, mustSee);
  const s: SeamlessStats = { hours: 0, changes: 0, shortStates: 0, flashes: 0, flashesToBreak: 0, shortLayouts: 0, commercialMs: 0, multiMs: 0, watchedMs: 0 };
  const shownSince = new Map<string, number>();
  let layout = '';
  let layoutSince = 0;
  let prevKey = '';
  let keySince = 0;
  let prev = 0;
  let view: DirectorView | undefined;
  for (let t = 0; t <= slate.endsAt; t += 1000) {
    d.ingestAll(src.poll(prev, t));
    prev = t;
    view = d.tick(t);
    const byId = new Map(view.insights.map((g) => [g.info.id, g]));
    const live = view.insights.some((g) => g.screen.phase === 'live' || g.screen.phase === 'break');
    if (!live) continue;
    s.watchedMs += 1000;
    if (view.layout !== 'single') s.multiMs += 1000;
    const main = byId.get(view.slots[0]);
    if (main && main.screen.phase === 'break' && isCommercial(main.screen.breakKind)) s.commercialMs += 1000;

    const key = `${view.layout}:${[...view.slots].sort().join(',')}`;
    if (prevKey && key !== prevKey) {
      s.changes++;
      if (t - keySince < FLASH_MS) s.shortStates++;
      keySince = t;
    }
    prevKey = key;
    if (view.layout !== layout) {
      if (layout && t - layoutSince < FLASH_MS) s.shortLayouts++;
      layout = view.layout;
      layoutSince = t;
    }
    for (const [id, since] of [...shownSince]) {
      if (view.slots.includes(id)) continue;
      shownSince.delete(id);
      if (t - since < FLASH_MS) {
        const g = byId.get(id)!;
        if (g.screen.phase === 'break' || g.screen.phase === 'final') s.flashesToBreak++;
        else s.flashes++;
      }
    }
    for (const id of view.slots) if (!shownSince.has(id)) shownSince.set(id, t);
  }
  s.hours = s.watchedMs / 3_600_000;
  return s;
}

const isMain = process.argv[1]?.endsWith('seamless.ts');
if (isMain) {
  const total: SeamlessStats = { hours: 0, changes: 0, shortStates: 0, flashes: 0, flashesToBreak: 0, shortLayouts: 0, commercialMs: 0, multiMs: 0, watchedMs: 0 };
  for (let seed = firstSeed; seed < firstSeed + nights; seed++) {
    const s = measure(seed);
    for (const k of Object.keys(total) as (keyof SeamlessStats)[]) total[k] += s[k];
  }
  const per = (x: number) => (x / total.hours).toFixed(1);
  console.log(`${nights} nights, ${total.hours.toFixed(1)} h of live games`);
  console.log(`  screen changes / h        ${per(total.changes)}`);
  console.log(`  screens lasting <60s / h  ${per(total.shortStates)}`);
  console.log(`  flashes (<60s, live) / h  ${per(total.flashes)}`);
  console.log(`  flashes into a break / h  ${per(total.flashesToBreak)}`);
  console.log(`  short layouts (<60s) / h  ${per(total.shortLayouts)}`);
  console.log(`  time in multiview         ${((100 * total.multiMs) / total.watchedMs).toFixed(1)}%`);
  console.log(`  commercial on main tile   ${((100 * total.commercialMs) / total.watchedMs).toFixed(1)}%`);
}
