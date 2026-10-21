# Contributing to Swivel

## Setup

```bash
corepack enable
yarn install
yarn check          # typecheck, lint, format check and all tests (what CI runs)
```

Node 22 and Yarn 4 (via corepack). For the Vega app you also need the Vega SDK; see the README's "Run it".

## Where things live

| Path | What |
| --- | --- |
| `packages/director` | The engine: pure TypeScript, no platform dependencies. Feed reducer, per-sport rules (`src/sports/`), the director policy, learning, recaps, simulators. |
| `packages/shared-ui/src/swivel` | The TV app: `SwivelApp` (splash → setup → watch), `screens/`, `watch/` (stage, tiles, rail, caption), `watch/venues/` (court, field, ballpark), `state/` (director hook, lineup, demo config, platform access). |
| `packages/shared-ui/src/remote-control` | Remote input per platform (Vega, Android TV, tvOS, web), all on one `KeyEmitter`. |
| `apps/vega` | The Vega OS shell (production target). |
| `apps/expo-multi-tv` | Web / Android TV shell, used for fast iteration. |

## Adding a sport

1. `packages/director/src/sports/<sport>.ts`: implement `Sport` (win probability, leverage, breaks, labels, recap scale) and register it in `sports/index.ts`.
2. `packages/director/src/sim/`: a simulator and a fictional league in `teams.ts` (team codes must be unique across leagues).
3. `packages/shared-ui/src/swivel/watch/venues/`: a venue drawing, registered in `VENUES`, and a glyph in `watch/SportGlyph.tsx`. Both are `Record<SportId, …>`, so TypeScript points at anything missing.
4. Tests in `packages/director/test/sports.test.ts`.

## Conventions

- Prettier (`yarn format`) and ESLint (`yarn lint`); commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint).
- Behavior changes to the director come with a test, and a before/after from `yarn workspace @swivel/director seamless` when they affect switching.
- Demo nights are deterministic: `scripts/demoTimeline.ts` prints exactly what a launch will show. Keep `docs/DEMO_SCRIPT.md` in sync when the default night changes.

## Reporting issues

Open a GitHub issue with steps to reproduce (the night `seed`, favorite teams and start time reproduce any session exactly).
