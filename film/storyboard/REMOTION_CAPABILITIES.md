# What our Remotion setup can do

For the Intatto film concept (close-guard 1.0.0), as checked on 25 Sep 2026 in `film/remotion`.
**Today** means it works with what is installed. **Add** means one command (`npx remotion add <pkg>`, a few
seconds, no account or cost) unless noted otherwise.

## The setup today

- Remotion 4.0.529 (React 19), 1920×1080 at 30 fps, rendered locally on this Mac (Apple Silicon). Installed:
  `remotion`, `@remotion/cli`, `@remotion/media` (video/audio), `@remotion/transitions`, `@remotion/google-fonts`,
  `@remotion/tailwind-v4`. Already in `node_modules` as dependencies, to be declared before use: `@remotion/paths`,
  `@remotion/shapes`, `@remotion/media-utils`, `@remotion/captions`.
- **Screen recordings:** scripted headless Chromium via `film/recorder/rig.mjs`, 1440×900 layout, 30 fps, drawn
  cursor, named marks per action. Tested today: launching Chromium with `--force-device-scale-factor=2` captures
  **2880×1800 frames at the same 1440×900 layout**. That makes zooms crisp. The rig still records at 1× until that
  flag is added (a one-line change for the recording helper, already noted in SHOT_LIST). Check the frame rate at
  2× with a 10 s test take.
- **Timing:** the infrastructure being built re-times every cut from the voice-over's word timings (local whisper.cpp)
  and the takes' mark labels. Motion can be cued to spoken words, not just to seconds.
- **Render cost:** a 3:30 film is ~6,300 frames. With embedded video, expect roughly 10–25 min per full render
  locally. Stills of any frame take seconds. Remotion Studio previews live.

## Capabilities

| Want | Today? | How | Limits and notes |
|---|---|---|---|
| **Camera moves on screen recordings** (push, pan, dolly, reframe, split-screen) | Today | CSS transforms on `<Video>` driven by `interpolate`/`spring`, per frame | Crisp up to ~1.5× full-frame (~2× in a framed window) once takes are 2×. At today's 1× takes, anything above ~1.1× softens. |
| **Zoom-to-cursor / follow the action** | Today, needs a small rig addition | Zoom and translate toward a focus point with eased, smoothed motion | Needs cursor x,y logged per frame or per mark. The rig knows every position it moves to but doesn't write them yet (small change). Focus can also come from the target element's box at each mark. |
| **3D transforms** (tilted device planes, card flips, parallax depth, recordings on angled planes) | Today | CSS 3D: `perspective`, `rotateX/Y`, `translateZ`, layered depth | No lighting or real geometry. Text on angled planes stays sharp only at modest angles. |
| **Real 3D scenes** (extruded wordmark, 3D charts, camera fly-through, a recording as a texture on a 3D screen) | Add `@remotion/three` + `three` + `@react-three/fiber` (+ `@react-three/drei`) | React Three Fiber inside Remotion, frame-driven camera | WebGL renders (Chrome ANGLE/GL flag in config). Video-as-texture works through Remotion's video texture hooks. Most build time per second of screen. |
| **Animated charts from real data** | Today (SVG) · Add `@remotion/paths` for path drawing | Lines draw on, bars grow, numbers count up from real JSON | Real data in the repo: **Dukascopy NVDA minute bars for Fri 24 and Mon 27 Jan 2025** (`data/replays/nvda-2025-01-gap.json`: Friday close 142.60, Monday open 124.82, Yahoo cross-check, sha256), the synthetic-gap series, live keeper posts (`intatto-keeper.larinova.com/log`), the credit API JSON, mainnet position numbers. `d3-scale`/`d3-shape` from npm if we want scales. |
| **Kinetic typography** (words landing on the spoken word, per-letter reveals, counters, highlights) | Today · Add `@remotion/layout-utils` (fit text) and `@remotion/rough-notation` (hand-drawn circles, underlines, highlights) | Per-word timing from whisper word timestamps | Google Fonts built in. A paid font needs the files. |
| **Transitions** | Today | `@remotion/transitions`: fade, slide, wipe, flip, clock-wipe, plus custom presentations (masks, zoom-through, match cuts) | Custom presentations are ordinary React, so any wipe shape or morph can be built. |
| **Light leaks, blur, colour and canvas effects** | Add `@remotion/effects` | Effects on `<Video>` and canvas components | |
| **Motion blur** | Add `@remotion/motion-blur` | Trail/camera motion blur on fast moves | Multiplies render time on the affected layers. |
| **Organic motion** (noise drift, subtle float) | Add `@remotion/noise` | Deterministic Perlin noise | |
| **Lottie** | Add `@remotion/lottie` (+ `lottie-web`) | Frame-accurate Lottie playback | Needs `.json` sources: LottieFiles (check each licence) or custom exports. No After Effects bridge is connected, so custom Lottie means building it elsewhere. |
| **Rive** | Add `@remotion/rive` | | Needs `.riv` files. |
| **GIFs / animated images** | Add `@remotion/gif` | | |
| **Audio: voice-over** | Today | `<Audio>` per beat, volume curves and ducking | Gabriel's MP3s drop into `film/vo/gabriel/`, loudness-normalised and word-timed locally. |
| **Audio: SFX** | Today, files must be fetched | Gabriel's approved library: 225 catalogued files with durations and attack times (`abel/docs/socials/sound-effects-library.json`), on Google Drive only (not synced to this Mac) | Download the chosen files by id. One event, one sound, placed on the picture frame. The skill's remotion.media demo sounds aren't our library, so we don't use them. |
| **Audio: music bed** | Not available | | No cleared music is on hand. Options: a licensed track Gabriel supplies, or generated music (Higgsfield Seed Audio), which spends credits and needs his explicit go-ahead. |
| **Captions + SRT** | Being built now | Phrase-grouped captions from word timings. SRT export for YouTube | |
| **Generated imagery or video** (textures, backgrounds, b-roll) | Gated | Higgsfield CLI (not checked in this session) | Needs Gabriel's go-ahead per asset and a credit ceiling. Real product footage stays real; nothing generated imitates the product. |

## Honesty constraints any concept must keep

- Every simulated scene carries its label on screen: SANDBOX, REPLAY · CFD data, SYNTHETIC. Only mainnet
  transactions are presented as real, with OKLink links shown.
- Motion graphics may restage product facts (charts, numbers, diagrams). Each number must trace to a source in
  `VO_SCRIPT.md` or the footage. No invented tickers or prices, no implied listing (the OKX AI listing is "under
  review"), no firstness, solvency or tax claims.

## Recommended additions for a produced motion piece

`npx remotion add @remotion/paths @remotion/shapes @remotion/layout-utils @remotion/effects @remotion/noise @remotion/motion-blur`.
Add `@remotion/three` stack only if the concept has real 3D scenes, and `@remotion/lottie` only if we have Lottie
files. Then change the rig to 2× capture and cursor logging before the 20:00 recordings.
