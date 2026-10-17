# @swivel/director

**A break-aware, preference-aware auto-director for watching many live games at once.** You give it each game's play-by-play and the channels it airs on. It decides what's on screen: which game, when to hop away for a commercial and when to come back, when to split the screen two, three or four ways, and why.

Pure TypeScript, zero runtime dependencies, runs anywhere: TV apps, web, Node. It's the engine inside Swivel (this repo's Vega OS app), kept platform-independent so it can be reused.

```ts
import { Director, ReplayLineupSource, buildSlate } from '@swivel/director';

const slate = buildSlate(51);                     // or your own games + feed
const source = new ReplayLineupSource(slate);
const director = new Director(source.games(), {
  favorites: ['TPA'], likes: [], loyalty: 'team-first', multiview: true,
});

let polled = 0;
setInterval(() => {
  const now = clock();                            // your slate clock, ms
  director.ingestAll(source.poll(polled, now));   // new play-by-play events
  polled = now;
  const view = director.tick(now);
  render(view.layout, view.slots, view.audio);    // what to show
  caption(view.decisions.at(-1));                 // why ("Timeout in HNL @ TPA…")
}, 250);
```

## What it does

- **Two views of every game.** The data feed runs 25–55 s ahead of the broadcast. The engine keeps a *feed* view and a *screen* view (feed minus channel delay) for every game. So it knows about a timeout before your stream shows it, never switches you into a game whose break is about to hit, and knows when play resumes before the video does. That gives a real "Back in 0:18" instead of a guess.
- **Break detection and hazard.** A reducer tracks timeouts, media timeouts (the 7:00 and 3:00 windows), quarter breaks, halftime, overtime and replay reviews. A hazard model estimates how likely a stoppage is soon (open media windows, scoring runs, late-game timeouts).
- **Leverage.** Closed-form win probability (margin as Brownian motion) and a leverage index: how much one possession swings the game, where 1.0 is an even opening tip and above 4 is crunch time.
- **The director policy.**
  - **Break hops with an anchor:** it leaves for a stoppage and returns to the game you were really watching, not every game it passed through.
  - **Anti-thrash:** a minimum time on a game, a score margin a new game must beat, and different thresholds for entering and leaving crunch time.
  - **Team first:** favorites win unless the game is a blowout, and you always return to your team.
  - **Multiview:** split, three-up or quad from the games on air. A game that goes to commercial leaves the grid immediately and comes back on resume. Tiles keep their positions, and audio stays with your team or a live tile.
- **Learns from the remote.** Picks, skips and holds update team affinities and a drama-vs-loyalty preference, on the device, and it announces what it learned.
- **"What you missed."** One-line catch-ups generated from the play-by-play (comebacks, runs, lead changes, a team pulling away). It's silent when you only missed a commercial.
- **Simulator.** A deterministic, possession-level pro-basketball simulator for a fictional league, with realistic scoring (about 113 points a team) and realistic stoppages. Use it for demos, tests and tuning, with no league data rights needed.

## Plugging in real data

```ts
interface LineupSource {
  games(): GameInfo[];                          // tonight's games + channel (with its stream delay)
  poll(from: number, to: number): FeedEvent[];  // play-by-play published in (from, to]
}
interface PlaybackController {
  show(layout: Layout, channelIds: string[], audioChannelId: string): void;
}
```

On Fire TV, `games()` comes from the Vega EPG Provider plus a licensed sports data feed, and `PlaybackController` maps to Vega Channel Tuning. A `FeedEvent` carries the running score, period, clock and an event type (`score`, `timeout`, `mandatory_timeout`, `review`, `resume`, `period_end`, …), which is close to the shape most commercial feeds expose.

**Know your channel delay.** The two-view model is only as good as `channel.delayMs`. In production, measure it (for example by comparing HLS `EXT-X-PROGRAM-DATE-TIME` with feed timestamps) rather than hard-coding it. This is the main production risk. To see how late "play resumes" reports affect it, build a slate with `buildSlate(seed, 8, { resumeLagMs: [5000, 15000] })`.

## Tools

```bash
cd packages/director
npx tsx --test test/*.test.ts   # or: yarn workspace @swivel/director test
# (the npm scripts below also work from this folder)
npm test                          # 23 unit tests
npm run headless -- 51 TPA        # print every decision over a simulated night
npm run demo-timeline -- 51 TPA 5960 8   # decisions at real-time offsets for a given start/speed
npm run find-slate -- 1 200       # nights with the most split/quad action
npm run find-demo -- 1 150        # (night, favorite team) pairs that make a good demo
```

## Layout

```
src/types.ts        FeedEvent, GameSnapshot, GameInsight, Decision, DirectorView
src/gameState.ts    reducer + per-game timeline (feed vs screen views, clock interpolation)
src/winprob.ts      win probability + leverage index
src/breakModel.ts   stoppage durations, hazard, runs
src/director.ts     the policy
src/learner.ts      on-device taste learning from remote presses
src/recap.ts        "What you missed" catch-ups
src/lineup.ts       LineupSource / PlaybackController + replay source
src/sim/            simulator, fictional league, slates
```

## Roadmap

- Pluggable recommender: replace the hand-set watch-score weights with an online-learned ranker trained on implicit feedback (picks, skips, dwell time), evaluated against simulated viewers with known preferences.
- More sports: NFL (two-minute warning, scoring and turnover breaks) and MLB (half-inning breaks).

## License

MIT-0
