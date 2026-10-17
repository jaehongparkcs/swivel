/**
 * Replays the default demo exactly as the app does (start time, replay speed,
 * 250 ms ticks) and prints each decision at its real-time offset, for a shot list.
 *   tsx scripts/demoTimeline.ts [seed] [fav] [startSec] [speed] [seconds]
 */
import { Director, ReplayLineupSource, buildSlate, periodLabel, clockLabel } from '../src';

const seed = Number(process.argv[2] ?? 51);
const fav = (process.argv[3] ?? 'TPA').split(',');
const start = Number(process.argv[4] ?? 5960) * 1000;
const speed = Number(process.argv[5] ?? 6);
const realSec = Number(process.argv[6] ?? 200);
const slate = buildSlate(seed);
const src = new ReplayLineupSource(slate);
const d = new Director(src.games(), { favorites: fav, likes: [], loyalty: 'team-first', multiview: true });
d.ingestAll(src.poll(-1, start));
let polled = start;
let seen = 0;
for (let real = 0; real <= realSec * 1000; real += 250) {
  const t = start + real * speed;
  d.ingestAll(src.poll(polled, t));
  polled = t;
  const v = d.tick(t);
  const fresh = v.decisions.slice(seen);
  seen = v.decisions.length;
  for (const x of fresh) {
    const p = v.insights.find((g) => g.info.id === v.audio);
    const mm = Math.floor(real / 60000);
    const ss = String(Math.floor((real % 60000) / 1000)).padStart(2, '0');
    console.log(`${mm}:${ss} [${v.layout}] ${x.title} — ${x.detail}${x.recap ? `  ⟶ ${x.recap.label}: ${x.recap.text}` : ''}  (${p ? periodLabel(p.screen.period) + ' ' + clockLabel(p.displayClock) : ''})`);
  }
}
