/**
 * Run the director over a whole simulated slate and print every decision.
 *   tsx scripts/runHeadless.ts [seed] [favorites,comma,separated]
 */
import { Director, buildSlate, gameClock, matchup, ReplayLineupSource, sportOf } from '../src';
import { SPORTS } from './env';

const seed = Number(process.argv[2] ?? 7);
const favorites = (process.argv[3] ?? '').split(',').filter(Boolean);
const slate = buildSlate(seed, 8, { sports: SPORTS });
const src = new ReplayLineupSource(slate);
const director = new Director(src.games(), { favorites, likes: [], loyalty: 'balanced', multiview: true });

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

console.log(`Slate ${seed}:`);
for (const g of slate.games) {
  const last = slate.events.filter((e) => e.gameId === g.id).pop()!;
  console.log(
    `  ${g.id} ${matchup(g)} tip ${fmt(g.scheduledStart)} delay ${g.channel.delayMs / 1000}s -> ${last.text} (${sportOf(g).periodLabel(last.period)})`,
  );
}

let seen = 0;
let prev = 0;
const counts: Record<string, number> = {};
for (let t = 0; t <= slate.endsAt + 60_000; t += 1000) {
  director.ingestAll(src.poll(prev, t));
  prev = t;
  const view = director.tick(t);
  const fresh = view.decisions.filter((d) => d.t === t);
  for (const d of fresh) {
    counts[d.kind] = (counts[d.kind] ?? 0) + 1;
    const p = view.insights.find((g) => g.info.id === view.slots[0]);
    const where = p ? gameClock(p).join(' ') : '';
    console.log(
      `${fmt(t)} [${view.layout.padEnd(6)}] ${d.kind.padEnd(12)} ${d.title} — ${d.detail}  {${view.slots.join(',')} ${where}}`,
    );
    if (d.recap) console.log(`         ↳ ${d.recap.label}: ${d.recap.text}`);
  }
  seen += fresh.length;
}
console.log('\ncounts', counts, 'total', seen);
