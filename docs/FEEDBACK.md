# Product feedback (fill in the [YOU] parts from your own experience)

The submission asks, for every tool, API or SDK used: what you used it for, what worked well, what needs work, how onboarding felt, and whether you'd build with it again.

## Vega OS SDK and CLI (0.24 / CLI 1.4.5)
- **Used for:** Building and packaging the app (`yarn build:vega` → `.vpkg`), and installing and launching it on the Virtual Device (`vega run-app`).
- **Worked well:** One-line installer; the first build of a React Native app produced valid packages for aarch64, armv7 and x86_64 with no native code. Manifest validation messages are clear. [YOU: how long setup took, anything smooth]
- **Needs work:** The build number and icon location aren't documented (friction log #1, #2); the deprecated `build-kepler` is still used by the samples (#3).
- **Onboarding:** [YOU]
- **Would build again:** [YOU]

## Vega Virtual Device
- **Used for:** Running and recording the demo.
- **Worked well:** [YOU: startup time, remote input, performance with 3–4 animated tiles]
- **Needs work:** No way to simulate Content Launcher / Alexa requests (#6). [YOU]

## react-native-multi-tv-app-sample
- **Used for:** The starting point: Vega and web from one codebase, remote-control handling (`RemoteControlManager.kepler.ts`), and the TV scaling helper.
- **Worked well:** The web target made iteration fast; the same UI code built for Vega unchanged.
- **Needs work:** Install peer warnings (#4); adding a shared package needs Metro edits in two places (#5); `build-kepler` deprecation (#3).

## Vega Live TV APIs (Channel Tuning, EPG Provider), docs only
- **Used for:** Designing the real-device integration (`LineupSource` / `PlaybackController`). Not called in the hackathon build.
- **Needs work:** The permissions and capabilities for third-party apps are unclear (#7).

## Content Launcher, docs only
- **Used for:** Evaluating Alexa voice ("watch the Tampa game"). Left out of the build.
- **Needs work:** No way to test on the VVD (#6).

## Amazon Devices Builder Tools (MCP server / Agent Skills)
- [YOU: if you used them; otherwise omit]

## Feature requests
| Request | Why it matters | Urgency |
|---|---|---|
| Live TV capability matrix for third-party apps (tune, EPG read, multiview/PiP) | Decides whether aggregator experiences like Fastbreak are possible on Vega | Critical |
| Multiview of live channels (2–4 tiles, one audio) as a platform API | Every sports aggregator wants it, and DRM makes it impossible to build from outside | Important |
| Platform signal for "in commercial break" or per-channel stream delay | Lets apps time switches precisely without computer vision on protected video | Important |
| VVD command to send Content Launcher requests | Makes Alexa integration testable | Important |
| Key-value storage documented in the RN getting-started guide | Persisting small preferences, like learned taste, is a day-one need | Nice-to-have |
