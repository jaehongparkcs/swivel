# Fastbreak

**Autopilot for a night of live basketball on Fire TV.** When your game goes to commercial, Fastbreak moves you to the best game that's live. When play resumes, it brings you back. When two or four games go down to the wire at once, it splits the screen, like a RedZone channel built around your own teams.

Built for the Amazon Developer Hackathon (Fire TV track) on **Vega OS** with React Native. The same code also runs in a browser for quick iteration.

![screens](docs/quad.png)

## What it does

- **Your team first.** When one of your teams is live, you're on it, unless it's a blowout. When your team comes back from a break, you go back immediately. In multiview, your team always gets the big tile and the audio. (The "Your teams" screen also offers *Balanced* and *Best game on*.)
- **Commercials leave the screen.** When your game breaks for a timeout, media timeout, quarter break or halftime, Fastbreak moves you to the best live game. In split, three-up or quad, a game that goes to commercial drops out of the grid at once, and the layout collapses (split becomes full screen). It comes back when play resumes. Replay reviews stay on screen, since they're game action.
- **No guessed countdowns.** Break lengths vary (media timeouts run about 1:50–3:50), so Fastbreak never invents one. It shows how long the break has run and watches the play-by-play feed for play to resume. Because the feed is 25–55 s ahead of the broadcast, it knows play is back *before your stream does*, which gives a real countdown ("Back in 0:18") and a switch timed to the moment the video returns.
- **Won't hop into a commercial.** If another game's feed already shows a timeout your stream hasn't reached, that game is skipped. While a break lasts, it prefers games that will still be live when the break ends.
- **Finds tight games.** A closed-form win-probability model scores how much each possession swings the outcome (leverage). Split, three-up and quad kick in when games are in crunch time, with your team included.
- **Never thrashes.** Minimum time on a game, a score margin a new game must beat to take over, hysteresis on what counts as crunch time, and a delay before cooled-off tiles leave.
- **Explains itself.** Every switch shows a reason, for example *"HNL @ TPA went to commercial. Full screen: KCS @ LVJ, 4th 2:52, 1-pt game."*

### Why not computer vision for break detection?

We considered detecting commercials from the picture (scorebug present or not, court colors). On Fire TV, premium live sports are DRM-protected and decoded on a secure path, so an app can't read those frames, even in its own player. The feed-lead approach above is more accurate anyway: it knows about breaks and resumptions *earlier* than the picture shows them. Vision does fit one job on the platform side: automatically calibrating each channel's delay by reading the scorebug clock. That's on our feature-request list for the Fire TV team.

## Remote

| Button | Action |
| --- | --- |
| Up / Down | Browse tonight's games (first press shows focus) |
| OK on a game | Watch it (autopilot still covers its breaks) |
| OK on "Your teams" | Pick favorites, likes, loyalty, split/quad on/off |
| Left into the video | Pick a tile in split/quad; OK makes it full screen |
| Play/Pause | Hold this game (pause autopilot) |
| Fast-forward | Jump to the next best game |
| Rewind | Demo only: cycle replay speed |

On web: arrow keys, Enter, Space (Play/Pause), `]` (Fast-forward), `[` (Rewind), Esc (Back).

## How it works

```
packages/director      pure TypeScript engine, no platform deps (unit tested)
  gameState.ts         play-by-play reducer; feed view vs. on-screen view per channel delay
  winprob.ts           win probability + leverage index
  breakModel.ts        stoppage durations, break hazard (media-timeout windows, runs, late game)
  director.ts          the policy: break hops, anchor/return, upgrades, must-see, split/quad, audio
  lineup.ts            LineupSource / PlaybackController interfaces (EPG + data feed adapters)
  sim/                 deterministic possession-level game simulator for a fictional league
packages/shared-ui/src/fastbreak   the 10-foot UI (stage, tiles, game rail, caption, teams)
apps/vega              Vega OS app shell
apps/expo-multi-tv     web / Android TV shell (used for fast iteration)
```

**On a real device**, `LineupSource` is built from the Vega **EPG Provider** (which channels in your lineup carry tonight's games) plus a licensed sports data feed. `PlaybackController` maps the primary slot to **Vega Channel Tuning**, with additional players for multiview tiles. The demo replays a simulated slate so it carries no league footage or data rights. Teams are fictional, and video tiles are a rendered "broadcast" driven by the feed.

## Run it

Prerequisites: Node 18+, Yarn 4 (`corepack enable`), and for Vega the Vega SDK (`vega --version`) with Java 21+.

```bash
yarn install

# Vega OS (Vega Virtual Device)
vega virtual-device start
yarn build:vega
vega run-app apps/vega/build/aarch64-release/*_aarch64.vpkg -d VirtualDevice   # x86_64 on Intel Macs

# Web (fast iteration)
yarn dev:web            # http://localhost:8082/?seed=74&speed=8

# Engine tests and tools
cd packages/director
npx tsx --test test/*.test.ts
npx tsx scripts/runHeadless.ts 51 TPA    # print every decision over a full night
npx tsx scripts/findSlate.ts 1 200       # search for demo-worthy nights
npx tsx scripts/findDemo.ts 1 150        # search nights x favorite teams for the best demo
```

Demo knobs are in `packages/shared-ui/src/fastbreak/demoConfig.ts`. The default is night `51` with Tampa as your team at 6x replay: a hop and return, split to three-up, commercials collapsing the grid, and Tampa going to overtime. `scripts/findDemo.ts` found it. On web, override with `?seed=&fav=TPA&speed=&start=<seconds>`.

## License

MIT-0. Built on Amazon's [react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0); its original README is in `TEMPLATE_README.md`.
