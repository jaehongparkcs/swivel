# Demo video: shot list (target 2:50, hard limit 3:00)

Judges aren't required to watch past 3:00, so the best material comes first.
Everything below is the **Vega Virtual Device** running the release build. The rules
require the video to show the app on a Fire TV device or the simulator.

## Setup (once)

```bash
cd ~/dev/amazonappdev/swivel
yarn build:vega
vega virtual-device start
vega run-app apps/vega/build/aarch64-release/vega_aarch64.vpkg -d VirtualDevice
```

- The default demo is built in: night 65 with basketball, football and baseball, Dallas (DAL, football) as your team, 8x replay, starting at the right moment. **Every launch replays the same sequence**, so you can retake freely. (The basketball-only night is `BASKETBALL_DEMO` in `packages/shared-ui/src/swivel/demoConfig.ts`.)
- Record the simulator window with QuickTime (File → New Screen Recording → select the window). Record narration separately, or live with a headset mic.
- Remote in the simulator: arrows, OK (Enter), Play/Pause, Fast-forward, Rewind. Check the VVD's remote panel or key mappings before recording.
- Relaunch the app right before the take that starts at 0:00. The clock starts at launch.

## Timeline

Times are **from app launch** (verified with `SPORTS=nba,nfl,mlb npx tsx scripts/demoTimeline.ts 65 DAL 9920 8` in `packages/director`). Video time = app time + 0:08 for the title card.

| Video | App time | What's on screen | Narration (suggested) |
|---|---|---|---|
| 0:00–0:08 | before launch | Title card: "Swivel: autopilot for game night" | "Basketball, football and baseball, all on at once. You care about one team, and you hate commercials." |
| 0:08 | 0:00 | Opens on **baseball**, SPK @ POR, tied in the 8th. Your team, Dallas (football), is stopped for a replay review | "Swivel reads every game's play-by-play. Your team, Dallas, is stopped, so it starts you on the best live game." |
| 0:14 | 0:06 | **Inning break** → hop to **basketball**, TPA @ PIT in the 4th | "Commercial in the ballgame? It moves you, and tells you why." |
| 0:21 | 0:13 | **"Your team is back on"**: Dallas football, 4th quarter, 4-point game | "The feed runs 30 seconds ahead of the broadcast, so it knows your team is back before your stream does." |
| 0:30 | 0:22 | **Split**: Dallas + a tied 8th inning | "When another game gets tight, it splits the screen. Your team keeps the big tile and the sound." |
| 0:40 | 0:32 | **Three-up: football, baseball and basketball at once** | "Three sports, three close finishes, one screen. Each with its own rules: inning breaks, TV timeouts, the two-minute warning." |
| 0:46 | 0:38 | TPA @ PIT heads to **overtime**: its tile leaves for the break | "No commercials on screen. A game on a break leaves the grid…" |
| 1:04 | 0:56 | **"TPA @ PIT is back"**: three-up again, now in overtime | "…and comes back the moment play resumes." |
| 1:10–1:50 | 1:02–1:42 | Overtime, a tied 9th, Dallas through the two-minute warning; audio follows the live action | (let it play, or cut) |
| 1:54 | 1:46 | **"Final: DAL 10, CHI 6"** → full screen on the next best game | "Your team closes it out. Swivel moves on to whatever's best." |
| 2:09 | 2:01 | **Split: basketball overtime + a tied 9th inning** | "It isn't only your team. It finds the best moment anywhere in your lineup, in any sport." |
| **Remote segment** (≈2:15–2:45) | | | |
| | | Press **Down** to show the game rail, pick another game with **OK** | "You're always in control. Pick any game with OK…" |
| | | Press **Fast-forward** on a game you don't care about | "…skip one with fast-forward. Swivel learns from both." |
| | | Pick the same game again. Caption: **"Learned: you like ___"** | "Pick a team twice and it learns you like them. No account, no cloud. It all runs on the TV." |
| | | **Play/Pause**: "Autopilot paused" | "Play/Pause holds a game when you don't want to be moved." |
| | | Open **Your teams**: favorites, the learned tags, "My teams first / Balanced / Best game on" | "Choose how loyal it should be." |
| 2:45–2:55 | | Closing card: architecture line + "Vega Live TV: EPG + channel tuning" | "Built on Vega in React Native. On a real Fire TV it plugs into your live TV lineup through the EPG and channel tuning." |

## Tips

- The video runs long without a cut: trim the 1:10–1:50 stretch first. Keep the three-sport three-up (0:40) and the final (1:54).
- Zoom in during editing on the caption and the rail's "Back in 0:18" countdowns. They're the proof that it isn't guessing.
- Avoid real league names, logos and music. Teams and video are deliberately fictional.
