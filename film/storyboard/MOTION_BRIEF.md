# Motion brief: "The market sleeps. The token doesn't."

> **Superseded in part (Gabriel, 25 Sep, after storyboard v2):** the look is now black and white like the app (white = market open, black = market closed, colour only for loss/pass, the system UI font) and the script is v3 (conversational). See `presentation/V3_NOTES.md` and `VO_SCRIPT.md`. The palette, type and script-specific beat lines below are out of date. The dial rules, the honesty rules and the real-data rules still hold.

Locked concept (Gabriel, 25 Sep). Script v2: `film/storyboard/VO_SCRIPT.md` (10 beats). The on-screen direction under
each beat there is the shot brief. Project: `film/remotion` (Remotion 4.0.529, 1920×1080, 30 fps). Read
`~/.claude/skills/motion-video-quality/SKILL.md` and `~/.claude/skills/remotion-best-practices/remotion-markup/REFERENCE.md`
before building. Also read `film/storyboard/REMOTION_CAPABILITIES.md`.

**Hard limits for every helper:** work only in `film/`. Never touch product code. No git commits. No uploads. Never
render the full film (stills and Studio only). No invented prices, headlines, tickers or hashes: every number and hash
on screen is real and listed in a data JSON with its source and retrieval time. Simulated scenes always carry
their label (SANDBOX / REPLAY · CFD data / SYNTHETIC · not market data). Keep each source file under 300 lines.
Leave no `console.log` in `src/`.

## Beat ids and voice-over files
`cold-open, problem, idea, real, saturday, replay, worst, proof, agents, close`. Gabriel's files will be
`film/vo/gabriel/01-cold-open.mp3` … `10-close.mp3`. Until then use scratch VO for timing.

## Look (the storyboard presentation uses the same, so Gabriel's reaction transfers)
- **Ground:** deep ink-navy `#0A0F1C` (the scene background), panels `#111A2E`, hairlines `rgba(255,255,255,0.08)`.
- **Market bell amber** (the regular session arc and warm accents): `#F2B544`, glow `#FFD27A`. Extended hours are the
  same amber at ~35% opacity.
- **Night steel** (nights, weekends, a closed market): `#2B3850` / `#3E4C66`, text on steel `#8FA0BA`.
- **Text:** `#E8EDF5`, muted `#8A96AA`. Semantic colours only: loss/limit red `#FF5D5D`, pass green `#38D39F`.
  SANDBOX label amber outline, REPLAY label `#7FA6FF`, SYNTHETIC label red outline.
- **Type:** display `Instrument Serif`, used sparingly (chapter words like "Friday.", the concept line, the wordmark,
  never long lines, not oversized italic). Body `IBM Plex Sans`. Numbers, hashes, tickers and labels
  `JetBrains Mono`, tabular. All via `@remotion/google-fonts`.
- **Texture:** faint film grain (≤4%) and a soft vignette. A bloom on the amber arc. No purple-blue gradients.
- **Layout:** safe margins 120 px at the sides, 100 px top and bottom. Relational type sizes, roughly: display
  96–140 px, body 40–48 px, mono data 28–34 px, labels 22 px. One focal point per moment.

## Motion language
- **Easing:** entrances ease-out expo `bezier(0.16,1,0.3,1)` over 18–24 f. Camera moves ease-in-out cubic. UI
  settles use a spring (damping ~200, no bounce). The only overshoot allowed is the SESSIONLIMIT stamp.
- **Pacing:** cinematic tension in beats 1–2 (slow push, long holds, darkness). From beat 3, calm and confident
  (Stripe/Linear launch-film pacing: crisp, purposeful, never busy). The close is uplifting and resolved.
- **Cues:** every entrance lands on its spoken word via `cueSeconds(beatId, phrase)`. No hard-coded seconds.
- **Craft check:** check intermediate poses. No text collisions and no half-faded remnants crossing glyphs. Staging
  varies (not left-copy/right-object every time).

## The motif: the SESSION DIAL
- A 24-hour ring in New York time, midnight at the top, clockwise. The regular session 09:30–16:00 ET is the bright
  amber arc. Pre-market 04:00–09:30 and after-hours 16:00–20:00 are dim amber. Overnight 20:00–04:00 is steel. On
  weekends (Fri 20:00 → Sun 20:00 ET) the whole ring goes dark steel. A needle shows the time. The centre reads the day
  and time, e.g. `FRI 16:00 ET`, over the session state (`OPEN` / `EXTENDED` / `CLOSED`). A small ring of 7 day
  pips (MON–SUN) lights the current day.
- **The LIMIT BAR** sits beside the dial: an LTV scale 0–100%. Its fill is the max new-borrow LTV. A fixed red line at
  65% is labelled "Liquidation 65% · never moves". The rules, as the real SessionRiskController implements them:
  OPEN 50%; EXTENDED (pre-market, after-hours, weekday overnight) 40%; CLOSED 30% decaying linearly to 20% over 64 h
  from Fri 20:00 ET; halted / corporate action / unknown 0%. Implement these as pure functions
  `sessionAt(etMinutesSinceMonday)` and `maxLtvAt(...)`, and drive the dial and the bar from the same clock.
- **The dial drives every transition:** at the end of a beat the dial (or its needle) turns to the next moment, and the
  next scene grows out of it (a radial wipe from the dial centre, a zoom through the ring, or the ring shrinking to
  a corner as a persistent clock). Build it as a global `DialTrack` layer with per-beat keyframes (position, scale,
  opacity, clock time), so it persists across scenes.

## Beat direction (motion graphics built now; UI footage arrives ~19:30–20:00)
1. **cold-open** (~10 s): darkness; the amber arc's last minutes. On the left, `NVDA · NASDAQ` ticks through the
   **real** last minutes of Fri 24 Jan 2025 from `data/replays/nvda-2025-01-gap.json` to the 16:00 close (142.60),
   then freezes and drops to steel with `CLOSED`. On the right, `NVDAx · onchain` keeps a live pulse (a heartbeat
   line or blocks ticking), **with no price number**. "Friday. Four p.m." in the display face. Slow push-in. Hold on
   "Its token doesn't."
2. **problem** (~28 s): the dial needle runs into the dark weekend and the darkness band spreads. The issuer readout
   is mono `maxOrderFiatValue: 0` (source: xStocks asset API, read 25 Sep 2026). "news" is an abstract flicker, not a
   fake headline. The real chart, Fri 24 → Mon 27 Jan 2025, has the weekend as a dark gap, and Monday's open cracks
   the line −12.47% (142.60 → 124.82). 405 dots burst (exactly 405), with the source line "Ventuals · mishandled 5-for-1
   split · Unchained". Hold on "So who pays for the weekend?".
3. **idea** (~22 s): "This is Intatto." wordmark, with "in·TAT·to — Italian for intact". The dial arrives full size
   with the limit bar. The needle runs a week: 50% → 40% → 30% → toward 20% by Monday while the 65% line holds.
   On-screen numbers match the rules above.
4. **real** (~15 s): a floating UI frame (placeholder until footage) and the OKLink callout: the borrow tx
   `0xa933d8de…0f45`, CollateralMarket `0xE670…9D0D` "verified". LIVE · X Layer mainnet.
5. **saturday** (~30 s): the dial spins forward Fri → Sat (weekend dark), the sandbox UI (placeholder), then a
   `SESSIONLIMIT` stamp (the contract error name) lands with the only overshoot in the film and a 2 px shake. Repay
   goes through. SANDBOX label.
6. **replay** (~20 s): the real minute chart draws itself. An LTV meter climbs as the price falls and stops at 59.57%
   under the red 65% line. "0 liquidations". REPLAY · CFD data (Dukascopy NVDA minute bars, 24 and 27 Jan 2025) plus
   SANDBOX.
7. **worst** (~22 s): SYNTHETIC. Collateral slices peel off (on the recorded run: 1 slice, 19.966 wNVDAx sold for
   2,037.58 USDG, floor held). The reserve tank drains 149.10 → 0. The lender-loss chip reads 147.69 USDG, share
   value 1.000008 → 0.997054 (−0.2954%). Keep the numbers in a JSON; the 20:00 re-shoot may change them.
8. **proof** (~10 s): two hash columns (X Layer mainnet vs the sandbox fork) slide together and lock row by row:
   fork block hash, contract bytecode hashes, a state value, the Intatto code hash. Then four green checks. Real
   values only.
9. **agents** (~13 s): the keeper heartbeat, one pulse per check. Real post timestamps and tx hashes from
   `https://intatto-keeper.larinova.com/log`. An agent's question bubble ("How much can 0x7F23…a415 borrow right
   now?") and the answer card from the real `/api/credit` JSON (session, capacity, liquidation price, gap). The
   OKX AI listing reads "under review" if shown.
10. **close** (~15 s): the dial comes to rest at Monday 09:30, dawn, the amber arc lit. "~$91.5M of xStocks on X
    Layer" (Crypto Briefing, 12 Sep 2026) · "0 listed on X Layer's Aave" (onchain read, 25 Sep 2026). The wordmark
    "Intatto", "Your loan, intact.", then "Live on X Layer · intatto.larinova.com". Hold 2.5 s.

## File ownership (never edit another helper's files; ask the coordinator)
- **cg-film-motion (Grok 4.7):** `src/Root.tsx`; `src/lib/cues.ts` (`cueSeconds(beatId, phrase)`: reads
  `src/data/vo.json` word timings if present, else a char-proportional estimate over `src/data/vo-scratch.json`
  durations and `src/data/script.json`); `src/data/script.json` → v2 (10 beats, lines verbatim from VO_SCRIPT.md)
  and scratch VO regeneration (`scripts/vo-scratch.mjs`, file names `NN-<id>`); `src/motion/theme.ts` (the tokens
  above) and fonts; `src/motion/dial/**` (SessionDial, LimitBar, session math, DialTrack); `src/motion/FloatingFrame.tsx`
  (a glass UI frame with slight 3D tilt and focus zoom, holding any child); scenes `src/motion/scenes/{ColdOpen,
  Problem,Idea,Close}.tsx`; `src/motion/compositions.tsx`. Root includes `src/motion/data/compositions.tsx` and
  `src/film/compositions.tsx`: create these as empty stubs if they're missing.
- **cg-film-data (Codex):** `src/motion/data/**` (real-data JSONs and the scripts that fetch them, each with source and
  retrieval time); the chart primitive `src/motion/chart/**` (a price line from the minute bars, which Problem also
  uses); scenes `src/motion/scenes/{Real,Saturday,Replay,Worst,Proof,Agents}.tsx` (the motion-graphics layers:
  callouts, stamp, chart, tank, hash lock, heartbeat). Footage slots stay as placeholders.
- **cg-film-edit (Grok 4.7):** `scripts/import-takes.mjs`, `scripts/vo-import.mjs`, `src/data/{takes,vo}.json`,
  `src/data/edl.ts`, `src/film/**` (the Film composition, footage segments, captions, SRT), `check-edl`, and the
  recorder upgrade (2× capture, cursor log). It imports cues from `src/lib/cues.ts` and the frame from
  `src/motion/FloatingFrame.tsx`.
- Shared: `package.json`. Add packages with `npx remotion add …` only, and tell the coordinator.

## Verify and report
`npx tsc --noEmit` clean. Render stills (`npx remotion still <composition-id> ../look/stills/<name>.png --frame N`),
then look at each one yourself: legibility, containers, labels, intermediate poses. Report to the coordinator with
`herdr agent prompt cg-film "[from <your-name>] ..."`: what's built, the still paths, and open issues.
