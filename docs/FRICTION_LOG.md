# Friction log

Entries come from actually building Fastbreak on Vega SDK 0.24 (Vega CLI 1.4.5) on an Apple Silicon Mac. Severity: low / medium / high.

### 1. Build number: the warning points to a manifest key that isn't documented (low)
- **Task:** Clear `WARNING: build_number is 0` during `yarn build:vega`.
- **Steps:** Read the warning ("Provide via --build-number CLI option or in manifest.toml [package] section"), then the App Manifest and VPT docs.
- **Expected:** A documented `[package]` key for the build number.
- **Actual:** The App Manifest page doesn't name one. VPT documents only `vpt pack -b/--build-number`, which `build-vega` doesn't obviously expose.
- **Workaround:** Left it at 0.
- **Suggestion:** Document the manifest key (or a `build-vega --build-number` flag) next to `icon` and `version`.

### 2. Icon: unclear where `@image/` files live (low)
- **Task:** Add an app icon.
- **Steps:** App Manifest docs show `icon = "@image/foo_icon.png"` but don't say which folder `@image` maps to, or the size and format.
- **Workaround:** Read `AmazonAppDev/vega-video-sample` and found `assets/image/VideoApp.png` (512×512 RGBA).
- **Suggestion:** One sentence on the manifest page: "`@image/x.png` resolves to `assets/image/x.png`; 512×512 PNG recommended."

### 3. The sample app uses a deprecated build command (low)
- **Task:** Build the multi-TV sample on Vega.
- **Actual:** Every build prints "This command is deprecated… replace usage with 'build-vega'", because the sample's scripts call `build-kepler`.
- **Suggestion:** Update `react-native-multi-tv-app-sample` scripts to `build-vega`. **We opened a PR that does this.**

### 4. Sample install prints peer-dependency warnings for Amazon packages (low)
- **Actual:** `yarn install` reports that `@multi-tv/vega` doesn't provide `@amazon-devices/keplerscript-turbomodule-api` (requested by `kepler-media-controls`), plus Babel plugin peers for `react-native-reanimated`.
- **Impact:** Harmless, but noisy for newcomers deciding whether their setup is broken.
- **Suggestion:** Add the peers to the sample, or document that they're expected.

### 5. Adding a shared workspace package means editing two Metro configs (low–medium)
- **Task:** Add a new monorepo package (`packages/director`) used by both the Vega and web apps.
- **Steps:** Adding it as a workspace dependency wasn't enough. Both `apps/vega/metro.config.js` and `apps/expo-multi-tv/metro.config.js` needed `watchFolders` and `extraNodeModules` entries.
- **Suggestion:** Have the sample resolve all `packages/*` automatically, or document the steps in the README. **Our PR does both.**

### 6. No documented way to test Content Launcher (Alexa) requests on the Virtual Device (medium)
- **Task:** Explore "Alexa, watch the Tampa game on Fastbreak".
- **Steps:** Read the Content Launcher integration guide and the VDA tools page.
- **Expected:** A CLI command to send a launch or search request to an app on the VVD.
- **Actual:** No such command is documented, so the voice path can't be demoed or tested without a device and catalog integration.
- **Workaround:** Left voice out of the hackathon build.
- **Suggestion:** Add something like `vega device content-launch --app <id> --query "..."` for the VVD.

### 7. Live TV APIs: unclear what third-party apps may do (medium, high for this product)
- **Task:** Design Fastbreak to drive the viewer's own live TV lineup.
- **Steps:** Read the Vega Live TV API overview (Channel Tuning, EPG Provider, EPG Sync Scheduler).
- **Actual:** The docs don't say whether a third-party app can tune *other providers'* channels, read the system EPG, or show multiple live channels at once (multiview / picture-in-picture).
- **Impact:** We had to build against a simulated lineup and pitch the integration as future work.
- **Suggestion:** A capability matrix: what an EPG provider app can do, what a generic app can do, and whether multiview or PiP of live channels is supported.

### 8. Voice input: no speech-to-text API for apps (medium)
- **Task:** Let viewers ask for a specific game by voice.
- **Actual:** The runtime privileges page mentions microphone access but lists no privilege IDs, and we found no speech-recognition API for apps.
- **Suggestion:** Document whether apps can get transcribed utterances (for example a "voice search" intent from Alexa), and list the microphone privilege ID.
