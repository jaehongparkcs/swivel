# Swivel: remaining work

Deadline: **Fri Oct 23, 2026, 12:00 PM PDT** (Devpost). Priorities: **P0** = needed to submit, **P1** = planned features, **P2** = known issues and polish.

Status as of Oct 16:
- **Done:** engine with 20 tests; TV app (single, split, three-up, quad layouts); team-first priority; commercials removed from the grid; resume countdowns taken from the feed; learning from remote presses; "What you missed" recaps; Vega build runs on the simulator; Swivel repo on GitHub.
- **Open-source PR:** https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/138, open.

---

## P0: needed to submit

### 1. Rename Fastbreak → Swivel
The app still says "Fastbreak" in about 90 places across about 30 files.
- [ ] **On-screen brand:** "Fastbreak" wordmark and tagline in `packages/shared-ui/src/fastbreak/FastbreakApp.tsx`.
- [ ] **Vega identity:**
  - `apps/vega/manifest.toml`: `title`, and `id` → `com.jaepark.swivel` (all ~10 occurrences), `partner-id`.
  - `apps/vega/app.json` (`name`, `displayName`) and `apps/vega/package.json` (`kepler.appName`).
  - Note: a new `id` installs as a **new app** on the simulator. Uninstall the old one so it doesn't show twice.
- [ ] **Code names:**
  - folder `packages/shared-ui/src/fastbreak/` → `swivel/`
  - `FastbreakApp` → `SwivelApp`, `useFastbreak` → `useSwivel`
  - exports in `packages/shared-ui/src/index.ts`; imports in `apps/vega/src/App.tsx` and `apps/expo-multi-tv/App.tsx`
  - web storage key `fastbreak.taste.v1` → `swivel.taste.v1`
- [ ] **Engine package:** `@fastbreak/director` → `@swivel/director`.
  - Update `packages/director/package.json`, the dependency lines in `apps/vega/package.json`, `apps/expo-multi-tv/package.json` and `packages/shared-ui/package.json`, and the aliases in both Metro configs.
  - Then run `yarn install` to refresh `yarn.lock`.
- [ ] **Icon:** keep `apps/vega/assets/image/fastbreak_icon.png` (the design fits "Swivel") but rename the file to `swivel_icon.png` and update `manifest.toml`.
- [ ] **Docs:** `README.md`, `packages/director/README.md`, everything in `docs/`. Include the pitch line contrasting Swivel with NBA CrunchTime and NFL RedZone: those are one channel for everyone; Swivel is personal, across your lineup, with no commercials.
- [ ] **Verify:** 20 tests pass (`cd packages/director && npx tsx --test test/*.test.ts`); `yarn build:vega` and run-app show "Swivel"; the web build renders.

### 2. Demo video (< 3:00)
- [ ] Rebuild after the rename, launch on the Vega Virtual Device, and record with QuickTime following `docs/DEMO_SCRIPT.md` (timings are from launch at 8x).
- [ ] Fix or narrate over the 0:05 caption "Play resumed… Taking you back" (see P2 #12).
- [ ] Remote segment: OK to pick a game, Fast-forward to skip one, "Learned: you like ___", Play/Pause to hold, the Your teams screen.
- [ ] No real league names, logos or music. Upload to YouTube or Vimeo as **public**, in English.

### 3. Devpost submission
- [ ] Description: paste from `docs/SUBMISSION.md` (after the rename).
- [ ] Repo URL: https://github.com/jaehongparkcs/Swivel (public, with an open-source license).
- [ ] Track: **Fire TV**. Mini challenge: **Open Source**. Contribution URL: PR #138; GitHub username `jaehongparkcs`; description is in `PR_INSTRUCTIONS.md` §5.
- [ ] Product feedback: finish the `[YOU]` parts of `docs/FEEDBACK.md` in your own words (setup time, simulator experience, would you build again).
- [ ] Friction log: paste `docs/FRICTION_LOG.md` (9 entries). Worth up to a 10% judging bonus.
- [ ] Feature requests: the table at the end of `docs/FEEDBACK.md`.
- [ ] Explain that the project started from Amazon's multi-TV sample, and list what was built during the window (everything except the template).

### 4. PR #138 follow-up
- [ ] Check for CI failures or review comments every day or two, and answer quickly. It doesn't need to be merged to count.

---

## P1: planned features (only if P0 is on track)

### 5. Recommender: learned ranking from implicit feedback
Replaces the hand-set watch-score weights. **It does not touch timing:** break hops, the anti-thrash rules and return-to-your-team stay rule-based.
- [ ] **Features per (viewer, candidate game):**
  - leverage, score margin, period and time left, overtime, scoring run
  - sport, period stage within the sport (e.g. "MLB 8th–9th")
  - team affinity (explicit and learned), seconds since last seen, already on screen
  - time of day as a weak feature; don't promise anything from it
- [ ] **Labels (implicit feedback):**
  - pick (OK) = the chosen game ranked above the other games **actually on air** at that moment (only real alternatives, to avoid exposure bias)
  - skip = negative
  - holding a game = positive
  - dwell after an automatic switch without touching the remote = weak positive
- [ ] **Model:** online pairwise logistic regression (or a small linear contextual bandit), warm-started from today's weights so day one behaves the same. Updates on the device.
- [ ] **Evaluation:** simulated viewers with hidden preferences (e.g. "loves comebacks", "ignores blowouts", "only late-game MLB"). Report regret and time-to-learn against the fixed weights. State plainly in the README that the viewers are simulated.
- [ ] **Deliverables:** module + tests in `packages/director`, an evaluation script, and a results table in the README.

### 6. NFL support (MLB if time allows)
- [ ] Generalize sport-specific parts (period structure, clock, break rules, leverage scale) behind a `Sport` interface.
- [ ] NFL break model: commercials after scores, after kickoffs, after turnovers or changes of possession, at the two-minute warning, at quarter ends, at halftime, and on challenges and reviews.
- [ ] NFL simulator: drive-level, realistic scoring.
- [ ] NFL win probability: down/distance/field position is ideal; a margin-and-time model is acceptable for v1.
- [ ] A mixed NBA + NFL demo night; rail and scorebug show the sport; tests.
- [ ] MLB: breaks between half-innings, pitching changes, leverage by inning, outs and runners.

### 7. Keep learned taste across restarts on Vega
- [ ] It's in memory only on Vega (web uses localStorage). Use Vega's key-value storage once confirmed in the docs, and save `TasteSnapshot` on every change.

---

## P2: known issues and polish

- [ ] **8. Learning credits both teams** in a picked game, so it can't tell "likes this game" from "likes this team". Consider splitting credit, or weighting toward the team whose affinity is already higher.
- [ ] **9. Channel delay is assumed known** (it's fixed in the simulator). Document it as the main production risk. Future: calibrate from HLS `EXT-X-PROGRAM-DATE-TIME` against feed timestamps.
- [ ] **10. The simulated "play resumes" event is perfectly timed.** Real feeds often report it 5–15 s late. Optionally add a random reporting lag to keep the demo honest.
- [ ] **11. Build number** is still 0 (harmless warning). Find whether `build-vega` accepts `--build-number`.
- [ ] **12. Cold-start wording:** when the app opens while your team is on a break, the first caption says "Play resumed… Taking you back" although you were never there. Change it to "Your team is back on" when the anchor came from startup.
- [ ] **13. Long team names** get cut off ("Louisville Thoroughb…") on the Your teams screen. Shrink the font or abbreviate.
- [ ] **14. `buildinfo.json`** is regenerated by each build. It's now in `.gitignore`. Delete the local copy if it reappears in `git status`.

## Deferred, mentioned as future work in the pitch

- **Voice** ("Alexa, watch the Tampa game"): via Content Launcher. It needs catalog integration, and the simulator can't test it.
- **Real live TV:** build the `LineupSource` from the Vega EPG Provider and drive the main tile with Vega Channel Tuning. This needs clarity on what third-party apps may tune (friction log #7).
- **Computer vision:** not possible on DRM-protected streams in an app. A platform-side delay calibration is on the feature-request list.
