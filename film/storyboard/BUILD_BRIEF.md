# Build brief: Intatto demo film, edit timeline and non-UI scenes

For the Grok 4.7 helper. Coordinator: cg-film (herdr pane wS:p4). Work only inside
`/Users/gabrielantonyxaviour/Documents/products/intatto/film/`. Never edit product code (`web/`, `contracts/`,
`services/`, `checks/`, `tests/`) or anything outside `film/`. No git commits. No uploads, no public posts.

**Gabriel's hold:** do not render the finished video (`remotion render` of the full film is forbidden). Verify with
`npx remotion still` frames and Remotion Studio only. The final cut must need only (1) the new screen recordings,
filmed after the 19:30 UTC screen freeze, and (2) Gabriel's own voice-over MP3s.

## Read first
- `film/storyboard/VO_SCRIPT.md`: the 9 beats and exact spoken lines (also `remotion/src/data/script.json`).
- `film/storyboard/SHOT_LIST.md`: take names, mark labels and what each shot must show. It's the contract with
  the recording helpers.
- `film/recorder/rig.mjs`, `film/recorder/marks.mjs`, `film/raw/*/take.json`: how takes and marks are stored.
  Video time 0 is the first frame. Mark video time = `mark.t + t0 - frames[0].t`.
- Remotion skill references: `~/.claude/skills/remotion-best-practices/` (`remotion-markup/REFERENCE.md`,
  `multi-scene-video.md`, `transitions.md`, `embedding-videos.md`, `voiceover.md`, `../remotion-captions/`).
- Project: `film/remotion` (Remotion 4.0.529, `@remotion/media`, `@remotion/transitions`, `@remotion/google-fonts`
  installed; npm). Keep every source file under 300 lines. No `console.log` left in `src/`.

## What to build

### 1. Take import: `scripts/import-takes.mjs`
For each take name in SHOT_LIST (`market, borrow-mainnet, explorer, weekend, proof, replays, agents, keeper,
keeper-explorer`), pick the newest `film/raw/<take>-<stamp>/take.mp4`, or the stamp pinned in
`src/data/take-pins.json`. Copy it to `public/takes/<take>.mp4` and write `src/data/takes.json`:
`{ <take>: { stamp, seconds, marks: { <label>: seconds } } }`. Takes from before the redesign use older labels.
Support an optional per-take `aliases` map in `take-pins.json` (old label → new label) so today's old-UI takes
can preview the timeline. Flag in the preview that they are the old UI.

### 2. Voice-over pipeline: `scripts/vo-import.mjs`
Per beat id (`hook, what, mainnet, saturday, proof, replay, synthetic, agents, close`):
- **Source:** `film/vo/gabriel/NN-<id>.mp3` (01…09) when present. Otherwise the scratch file
  `public/vo/scratch/<id>.wav` (regenerate with `scripts/vo-scratch.mjs` if the script changed). If Gabriel sends
  a single long file, split it on silences of 2.5 s or more into the 9 beats, and report the split points for checking.
- Normalise with ffmpeg: mono 48 kHz, loudnorm to about −16 LUFS, trim silence at the head and tail to ~0.2 s.
  Write `public/vo/active/<id>.wav`.
- **Word timings, run locally:** whisper.cpp via `@remotion/install-whisper-cpp` (English model, install inside
  `film/remotion/whisper/`). Never send Gabriel's voice to a cloud API. Write `src/data/vo.json`:
  `{ <id>: { source: "gabriel"|"scratch", file, seconds, words: [{ text, start, end }] } }`.

### 3. Cues
`src/lib/cues.ts` exports `cueSeconds(beatId, phrase)`, the VO time (in seconds) where `phrase` starts. It matches
the phrase's words against `vo.json` words case-insensitively, ignoring punctuation. When no match is found, fall
back to a character-proportional estimate and record a warning. Scenes and the EDL use cues only, never
hard-coded seconds, so a new voice-over re-times everything.

### 4. Edit decision list: `src/data/edl.ts`
Per footage beat, an ordered list of segments:
`{ take, mark, offset?: s, cue: phrase|null, rate?: number, url: string, label: LabelKind, focus?: { x, y, w, h, zoom } }`.
A segment starts at its cue (null = scene start) and runs until the next segment's cue or the scene's end. Its
source starts at `marks[mark] + offset`. Set offsets so the named action lands on the spoken word (for example,
the Jump to Saturday click lands on "Saturday"). A long wait (replay running, approvals) is either cut or
played at `rate` 2–4. When `rate > 1`, show a small "×N" chip on the frame.
The beat plan, one segment per row (phrases are from `script.json`):
- **what:** title card over the first sentence; `market` from "How much you can borrow" (`session`, then `max-ltv`),
  "The liquidation line" (`threshold`), "The price is our keeper" (`relay`, popover open).
- **mainnet:** `borrow-mainnet` `connect` at scene start, "This wallet" (`collateral`), "Thirty-six" (`ltv-health`),
  "NVIDIA would have to fall" (`can-fall`, then `monday-gap`), "Here's the borrow" (`explorer` `borrow-row`),
  "on a verified contract" (`explorer` `contracts-tab`).
- **saturday:** `weekend` `start-click`, "a fork of X Layer" (`session-ready`), "I borrow on a weekday" (`loan-typed`,
  then review → borrowed at ×3–4), "let's make it Saturday" (`saturday-click` on "Saturday"), "The session closes"
  (`saturday-done`, then `limit`), "I ask for more" (`try-more` → `refused`), "Repaying still works" (`repay-tab` →
  `repaid` at ×2–3).
- **proof:** `proof` `proof-click` (skip the run at ×4 or cut), "These checks run" (`checks-done`), "and a ledger"
  (`ledger`).
- **replay:** `replays` `jan-click`, "NVIDIA closed on Friday" (`jan-done`, then `jan-ledger`), "Replayed on the fork"
  (`risk-loans`), "Nobody is liquidated" (`risk-liqs`).
- **synthetic:** `replays` `syn-click`, "The loan is sold" (`risk-liqs-2`), "What it can't cover" (`deficit`),
  "They're told" (`primer-lose`, or `share-price` if there was no primer).
- **agents:** `agents` `loaded`/`credit-card`, "It answers" (`submit` → `report` → `response-details`), "And our keeper"
  (`keeper` `keeper-sheet`, falling back to `keeper-explorer` `rows`), "Every post" (`keeper-explorer` `rows`).
- **Labels:** `what`, `mainnet` and `agents` = LIVE · X Layer mainnet (the explorer segments too). `saturday` and
  `proof` = SANDBOX · fork of X Layer mainnet. `replay` = REPLAY · CFD data (Dukascopy NVDA minute bars, 24 and 27
  Jan 2025), with SANDBOX. `synthetic` = SYNTHETIC · not market data, with SANDBOX.
- **Missing footage:** if a take or mark is missing, render a clearly marked placeholder inside the browser frame
  ("TO RECORD: <take> · <mark>"). The whole timeline must preview end to end today.
- `npm run check-edl`: prints, per segment, the source in/out, rate, whether the footage covers the span (a freeze
  or a placeholder counts as a failure), and any cue fallback warnings.

### 5. Components and scenes (plain frames: no product look, no brand invention)
- **Canvas:** 1920×1080, 30 fps. Tokens in `src/theme.ts`: background `#F5F5F2`, ink `#121212`, muted `#5F6368`,
  rule `#DADCD7`. Label kinds: LIVE `#1E7F4F`, SANDBOX ink `#7A5600` on `#FFF1CC`, REPLAY `#2F55B5`, SYNTHETIC
  `#B3261E`. Fonts: Inter (text) and JetBrains Mono (labels, data, URLs) via `@remotion/google-fonts`.
- **BrowserFrame:** the 1440×900 footage at scale 0.9 (1296×810), 1:1 pixel crop, no letterboxing. A 36 px chrome
  bar above it with three neutral window dots and a URL pill showing the segment's real URL. Radius 12, soft shadow,
  top edge at y≈96, horizontally centred. Enters with a 24 px upward settle and a fade (~14 frames). Across the
  scene, a slow push from 1.00 to 1.02. Focus zooms ≤ 1.25 into `focus` rects over ~0.6 s, ease-in-out, and release
  before the next cut. Cuts inside a scene get a 4-frame crossfade.
- **LabelChip:** top-left above the frame (y≈40), mono 22 px, uppercase, the dot plus the text. Visible for the whole
  scene: a label never disappears while its footage is on screen.
- **Captions:** below the frame (y ≥ 950), Inter 30 px, max 2 lines of ≤ 44 characters, grouped by phrase from the
  word timings, no word-by-word flashing. Also export `out/intatto-demo.srt`.
- **Hook** (`src/scenes/Hook.tsx`): two week-long bars, Mon to Sun. "NVDA · Nasdaq" shows weekday session blocks and
  an empty weekend labelled "Closed". "NVDAx · X Layer" is one continuous bar labelled "Trades onchain, 24/7". A
  playhead sits on Saturday. It's a schematic: no prices, no fake tickers. Three fact cards follow, each entering on
  its cue:
  - "$0": "Issuer's max order while the market is closed" · xStocks public asset API, read 25 Sep 2026
  - "0": "Venus: stock collateral launched with borrowing switched off" · CryptoSlate
  - "405": "Users liquidated after a mishandled split on Ventuals" · Unchained
  Vary the staging (not left-copy/right-object every time) and keep the motion calm.
- **Title** (first sentence of `what`): the wordmark "Intatto" (Inter 700, ~140 px) and the line "Borrow against
  tokenized stocks on X Layer, with limits that know when the stock market is closed." The browser frame then rises
  in on the "How much you can borrow" cue.
- **Close** (`src/scenes/Close.tsx`), on cues:
  - "Everything Intatto needs lives on X Layer": four small items (xStocks · their pools · USDG · OKX AI).
  - Stats: "$91.5M" "xStocks on X Layer · Crypto Briefing, 12 Sep 2026" and "0" "xStocks listed on X Layer's Aave ·
    onchain read, 25 Sep 2026".
  - "Next": "Chainlink Data Streams live · more stocks".
  - "Intatto.": clears to the wordmark, the line, then `intatto.larinova.com` and "Live on X Layer mainnet · contracts
    verified on OKLink". Hold 2.5 s after the last word.
- **Film** (`src/Film.tsx` + `Root.tsx`): TransitionSeries of the 9 scenes, 12-frame fades between scenes, each VO on
  its scene (lead 0.5 s, tail 0.9 s), VO only (no music, no SFX). Register each scene as its own composition in a
  "Scenes" folder.
- **Motion craft:** read `~/.claude/skills/motion-video-quality/SKILL.md`. Check intermediate poses: no text
  collisions, no half-faded labels crossing glyphs.

### 6. Verify, then report
- `npx tsc --noEmit` clean. `npm run check-edl` all green, except placeholders for shots not yet filmed.
- Render stills (`npx remotion still`) at: each scene's first settled frame, every fact card, the title, the
  Saturday click, the refusal, the replay ledger, the deficit, the close URL. Look at every still yourself: text
  inside its container, labels never cropped, captions ≤ 2 lines. Save them in `film/look/stills/`.
- Report to the coordinator with `herdr agent prompt cg-film "[from cg-film-edit] ..."`: what's built, the `check-edl`
  summary, the still paths, anything you couldn't do. Don't stop at a partial build without reporting.
