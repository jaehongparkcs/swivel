# Demo video: shot list (target 2:50, hard limit 3:00)

Judges aren't required to watch past 3:00, so the best material comes first.
Everything below is the **Vega Virtual Device** running the release build. The rules
require the video to show the app on a Fire TV device or the simulator.

## Setup (once)

```bash
cd ~/dev/amazonappdev/swivel
yarn build:vega
vega virtual-device start
vega run-app apps/vega/build/aarch64-release/*_aarch64.vpkg -d VirtualDevice
```

- The default demo is built in: night 51, Tampa (TPA) as your team, 8x replay, starting at the right moment. **Every launch replays the same sequence**, so you can retake freely.
- Record the simulator window with QuickTime (File → New Screen Recording → select the window). Record narration separately, or live with a headset mic.
- Remote in the simulator: arrows, OK (Enter), Play/Pause, Fast-forward, Rewind. Check the VVD's remote panel or key mappings before recording.
- Relaunch the app right before the take that starts at 0:00. The clock starts at launch.

## Timeline

Times are **from app launch** (verified with `packages/director/scripts/demoTimeline.ts 51 TPA 5960 8`).

| Video | App time | What's on screen | Narration (suggested) |
|---|---|---|---|
| 0:00–0:08 | before launch | Title card: "Swivel: autopilot for game night" | "Ten games on tonight. You care about one team, and you hate commercials." |
| 0:08 | 0:00 | App opens on NSH @ OMA. TPA is on a break | "Swivel watches every game's play-by-play. Your team, Tampa, is on a break, so it starts you on the best live game." |
| 0:13 | 0:05 | **"Your team is back on. Play resumed in HNL @ TPA."** | "The data feed runs 30 seconds ahead of the broadcast, so we know play is back before your stream does. You land the moment it resumes." |
| 0:19 | 0:11 | **Split screen**: TPA plus NSH @ OMA, a 1-pt game in the 4th | "When another game goes down to the wire, it splits the screen. Your team keeps the audio and the win-probability bar." |
| 0:40 | 0:32 | **Three-up**: KCS @ LVJ joins | "A third close finish: three-up, with your team on the big tile." |
| 0:43 | 0:35 | NSH @ OMA **went to commercial**, back to split | "No commercials on screen. A game that goes to break simply leaves the grid…" |
| 0:45 | 0:37 | TPA went to commercial, **full screen on KCS @ LVJ** | "…and when it's your team's break, you get the best live game full screen. The rail counts how long the break has run. There's no fake countdown." |
| 0:47 | 0:39 | Hop to BAL @ STL with **"How we got here: BAL took the lead on a 7–0 run"** | "Every switch tells you why, plus a one-line catch-up written from the play-by-play." |
| 1:04 | 0:56 | **Back to TPA** when play resumes | "Back to your team, automatically." |
| 1:08–1:15 | 1:00–1:07 | Split, then three-up, then commercials collapsing it again | (let it play, or cut) |
| 1:30 | 1:22 | Split: two other games in the final 2 minutes while TPA is at the quarter break | "It isn't only your team. It finds the best basketball anywhere in your lineup." |
| 1:42 | 1:34 | **"HNL @ TPA is back"**: three-up again | |
| 1:54 | 1:46–1:54 | Games go final, the grid shrinks to TPA full screen | |
| **Remote segment** (≈2:00–2:40) | | | |
| | | Press **Down** to show the game rail, pick another game with **OK** | "You're always in control. Pick any game with OK…" |
| | | Press **Fast-forward** on a game you don't care about | "…skip one with fast-forward. Swivel learns from both." |
| | | Pick the same game again. Caption: **"Learned: you like ___"** | "Pick a team twice and it learns you like them. No account, no cloud. It all runs on the TV." |
| | | **Play/Pause**: "Autopilot paused" | "Play/Pause holds a game when you don't want to be moved." |
| | | Open **Your teams**: favorites, the learned tags, "My teams first / Balanced / Best game on" | "Choose how loyal it should be." |
| 2:40–2:50 | | Closing card: architecture line + "Vega Live TV: EPG + channel tuning" | "Built on Vega in React Native. On a real Fire TV it plugs into your live TV lineup through the EPG and channel tuning." |

## Tips

- If a take runs long, cut the 1:08–1:20 stretch first. It repeats the split, three-up and collapse pattern.
- Zoom in during editing on the caption and the rail's "Back in 0:18" countdowns. They're the proof that it isn't guessing.
- Avoid real league names, logos and music. Teams and video are deliberately fictional.
