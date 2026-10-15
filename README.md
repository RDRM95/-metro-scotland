# METRO SCOTLAND — THE SURFACE NETWORK

A cinematic pixel-art military horror short that plays in the browser.

Glasgow, 11 October 2033. Twenty years after the war, the surviving UK and
Scottish authorities still watch the surface through a joint reconnaissance
network of remote cameras. Tonight, camera twelve on the Clyde picks up
something that is four metres tall, aware of every lens, and in more than one
place at once.

The film is roughly 2 minutes 40 seconds, in six parts:

1. **Scotland Control** — a hardened command centre, a routine detection alert.
2. **Glasgow Surface** — CAM-12 on the Clyde corridor, rain, thermal.
3. **The Entity** — it walks wrong, it stops, it looks at the lens, it points.
4. **The Network** — four feeds, one entity, identical timestamps; the map goes red.
5. **Something Is Inside** — the feeds die; one monitor returns: Corridor B-17. Ours.
6. End card.

Everything on screen is drawn procedurally at 480×270 and scaled with
nearest-neighbour filtering. Every sound is synthesised with the Web Audio API.
There are no external assets.

## Watch it

The production build is deployed to GitHub Pages from the `main` branch by the
workflow in `.github/workflows/deploy.yml`. Open the site, tap or click to
initialise the terminal (this unlocks audio on mobile), then **BEGIN
TRANSMISSION**.

Controls: Space play/pause · R restart · ← → seek 5 s · ↑ ↓ volume · M mute ·
C subtitles · F fullscreen · Esc menu. On touch devices tap the picture to
reveal the controls, and use the fullscreen button; landscape is recommended.

## Run it locally

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

```bash
npm run check      # typecheck + unit tests + production build
npm run preview    # serve dist/ at http://127.0.0.1:4173
npm run test:e2e   # Playwright browser tests against the preview build
node scripts/shots.mjs out/   # capture deterministic review frames
node scripts/perf.mjs         # steady-state frame timing per scene
```

Node 22 or newer. Playwright uses the Chromium at `/opt/pw-browsers/chromium`
when present, otherwise run `npx playwright install chromium` once.

## How it is built

| Area | Where | Notes |
| --- | --- | --- |
| Rendering | `src/engine/` | 480×270 offscreen frame, integer scaling, bitmap fonts (5×7 and 3×5), seeded noise |
| Camera | `src/camera/Camera.ts` | keyframed pan/zoom/shake over larger world surfaces |
| Scenes & timeline | `src/scenes/`, `src/timeline/`, `src/Film.ts` | each scene renders deterministically from local time, so seeking is just "render at t" |
| Environments | `src/environments/` | Scotland Control, the Clyde corridor, Glasgow Central, the M8, a dead shipyard, Corridor B-17, the map of Scotland |
| Characters | `src/characters/Operator.ts` | posed operators: breathing, blinking, head turns, typing, coffee, flinching |
| Creature | `src/creatures/Entity.ts` | 3-D skeleton with wrong-way joints, walk cycle, head turn, pointing, corridor compression, thermal form |
| Effects | `src/particles/`, `src/lighting/`, `src/surveillance/` | rain, fog, dust, flicker, CCTV overlays, thermal and image-intensifier passes, tearing, static |
| Audio | `src/audio/AudioEngine.ts` | ten ambience buses and ~20 synthesised one-shots, driven by per-scene mixes and timed cues |
| Dialogue | `src/dialogue/` | timed script with radio treatment, drawn as in-frame subtitles |
| UI | `src/menus/Menu.ts`, `src/controls/Controls.ts` | in-canvas menu and settings; DOM playback bar |
| Tests | `tests/unit`, `tests/e2e` | Vitest (timeline, script, fonts, map, poses, film structure) and Playwright (load, menu, playback, controls, every scene renders, mobile viewport) |

The Vite base path is relative (`./`) so the same build serves from a project
page such as `https://<user>.github.io/<repo>/` without changes.

## Deployment

`deploy.yml` checks out, installs, type-checks, runs the unit tests, builds,
uploads `dist/` with `actions/upload-pages-artifact` and deploys with
`actions/deploy-pages`. In the repository settings, **Pages → Build and
deployment → Source** must be set to **GitHub Actions** the first time. Every
later push to `main` redeploys. `ci.yml` runs the same checks plus the browser
tests on pull requests and other branches.

## Video export

`scripts/export-video.mjs` captures frames through the same deterministic
`renderAt` hook and can hand them to FFmpeg for an MP4/WebM; see the script for
options. Exported video is not committed.
