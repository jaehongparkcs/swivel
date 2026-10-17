# Devpost submission draft

**Track:** Fire TV (Vega OS)
**Mini challenge:** Open Source, via a pull request to Amazon's `react-native-multi-tv-app-sample` (see `../PR_INSTRUCTIONS.md`). AWS Builder: not entered (no AWS services used).

---

## Swivel: autopilot for a night of live basketball

### Inspiration
On a busy night there are ten games on and you care about one team. Every timeout you're staring at the same commercials while somewhere else a game is coming down to the last possession. NBA CrunchTime and NFL RedZone solve this with one channel that's the same for everyone. Swivel is personal: it follows *your* teams, across *your* live TV lineup, with no commercials and without touching the remote.

### What it does
- **Hops on breaks.** When your game goes to a timeout, media timeout, quarter break or halftime, Swivel moves you to the best live game. When play resumes, it brings you back.
- **Knows before your stream does.** Play-by-play data runs 25–55 s ahead of the broadcast. Swivel uses that lead to switch at exactly the right moment. It shows a real "Back in 0:18" when it already knows play has resumed, and never invents a countdown.
- **Never takes you into a commercial.** If another game's feed already shows a timeout your stream hasn't reached, that game is skipped.
- **Split, three-up and quad.** When several games are in crunch time, the screen splits automatically, with your team on the big tile and the audio. A game that goes to commercial leaves the grid at once, and the layout collapses back to full screen.
- **Your team first.** Favorites always win unless the game is a blowout. You can choose *My teams first*, *Balanced* or *Best game on*.
- **Learns from your remote.** Picking, skipping and holding games teaches it which teams you like and how much you chase close games. It runs entirely on the device.
- **Tells you why, and what you missed.** Every switch has a one-line reason and a catch-up generated from the play-by-play ("While you were away: LVJ cut a 10-point lead to 1").

### How we built it
- **Vega OS app in React Native**, built on Amazon's multi-TV sample. The same UI also runs on web, for fast iteration.
- **`@swivel/director`**: a pure-TypeScript engine with no platform dependencies, covered by 23 unit tests:
  - a play-by-play reducer that keeps two views of every game: what the feed knows, and what your stream shows (feed time minus channel delay);
  - closed-form win probability and a **leverage index** (how much one possession swings the game);
  - a break model built from basketball's rules (media-timeout windows at 7:00 and 3:00, coaches stopping runs, late-game timeouts);
  - the director policy, with minimum time on a game, a margin a new game must beat, hysteresis on what counts as crunch time, an anchor/return to your game, and stable multiview tiles;
  - an on-device taste learner and a play-by-play recap generator.
- **A deterministic game simulator** (fictional league, realistic scoring and stoppages) drives the demo, so it carries no league footage or data rights. Search scripts find nights that exercise every behavior.

### Challenges
- **Thrashing.** Early versions bounced between games every few seconds. Fixes: a minimum time on each game, a margin a challenger must beat, a single "anchor" game to return to, and different thresholds for entering and leaving crunch time.
- **Not knowing how long a break will last.** Media timeouts vary by minutes. We dropped estimated countdowns and use the feed's lead over the broadcast as a real signal instead.
- **Platform reality.** Live sports are DRM-protected, so detecting commercials with computer vision isn't possible in a third-party app. The feed-lead approach is earlier and more reliable anyway.

### Accomplishments
- A director that feels like a human producer: it never jumps into a commercial, never ping-pongs, and always comes back to your team.
- 23 unit tests, plus headless tools that replay whole nights and print every decision.

### What we learned
- Vega's React Native stack made a TV-first, remote-driven UI straightforward, and the multi-TV sample let us iterate on the web and ship on Vega from one codebase.
- On TV, explaining an automatic switch matters as much as making a good one.

### What's next
- **Real lineup and data:** build the `LineupSource` from the Vega **EPG Provider** (which channels in your lineup carry tonight's games) and drive the primary tile with **Vega Channel Tuning**.
- **Delay calibration:** use HLS program-date-time (or platform-side scorebug reading) to measure each channel's lag automatically.
- **Alexa:** "Alexa, follow Tampa and anything within five in the fourth" via Content Launcher.
- More sports (NFL and college football have very predictable break structures).

### Built with
TypeScript · React Native · Vega OS SDK · Vega Virtual Device · react-tv-space-navigation · Expo (web target)

---

## Open Source mini challenge

Contribution: a pull request to `AmazonAppDev/react-native-multi-tv-app-sample` that makes both Metro configs auto-discover `packages/*` workspaces and documents shared packages (friction log #5). The `build-vega` fix (#3) was dropped because maintainer PR #132 already does it. The PR also reports the build-rewrites-tracked-files issue (#9). The fields to paste are in `PR_INSTRUCTIONS.md`, one folder up.
