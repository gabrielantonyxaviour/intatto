# Motion v3 brief: real produced clips for every beat

From cg-film (the video lead, pane wR:pH). Gabriel, 25 Sep:

> "I want to see you building real motion graphic video shots in the presentation instead of showing mock
> wireframes … for each frame show real fully edited and produced clips for each scene or transition, motion
> graphics video clips that shows what an incredible motion designer you are."

Each beat becomes a finished Remotion scene, rendered as its own clip and embedded in the storyboard page. **These
are the film's real scenes**: the final cut later reuses them with Gabriel's voice-over and the post-redesign UI
footage. Build them for keeps.

**Model rule (Gabriel's):** motion and Remotion work is done only by Claude Opus 5.5 at high effort. That's you.

## Read first
1. `film/storyboard/VO_SCRIPT.md` (v3.2): 10 beats, their durations, the exact lines and the on-screen direction in
   italics. This is the shot brief.
2. `film/storyboard/presentation/V3_NOTES.md`: Gabriel's words on the look (black and white like the app, white =
   market open, black = market closed, colour only when it means something).
3. `~/.claude/skills/motion-video-quality/SKILL.md` (Gabriel's craft standards: read it all) and
   `~/.claude/skills/remotion-best-practices/remotion-markup/REFERENCE.md`, plus `timing.md`, `transitions.md`,
   `sequencing.md` and `embedding-videos.md` in the same folder.
4. `film/storyboard/GROK_REVIEW.md` (what exists in the project, and what is broken).

## Look (identical across all scenes)
- **Two grounds:** white `#FFFFFF` with ink `#0A0A0A`, and black `#0A0A0A` with ink `#FFFFFF`. Greys for secondary text:
  `#737373` on white, `#A3A3A3` on black. Hairlines: `#E5E5E5` on white, `#262626` on black.
- **Colour only with meaning:** red `#E5484D` for loss, refusal and the 65% liquidation line; green `#30A46C` for
  pass/verified. Nothing decorative.
- **Type:** `Inter` for all text (display in weight 600–700 with tight tracking, about −0.03em; body 400–500) and
  `JetBrains Mono` for numbers, hashes, tickers and labels (tabular). Load both via `@remotion/google-fonts`.
  Hierarchy comes from size and weight, not extra fonts or colour.
- **Layout:** 1920×1080, 30 fps. Safe margins of 120 px at the sides and 100 px top and bottom. One focal point per
  moment. Generous negative space: think Linear and Vercel launch films, not a dashboard.
- **Honesty chips:** SANDBOX · fork of X Layer mainnet / REPLAY · CFD data / SYNTHETIC · not market data, as
  outlined mono chips (SYNTHETIC with a red outline), visible for the whole time that content is on screen. Real
  mainnet material gets "LIVE · X Layer mainnet".
- **Small source lines** under every real number (for example "Crypto Briefing · 12 Sep 2026"), in grey mono at
  about 20 px.

## The motif: the session dial and the theme flip
- **The dial:** a 24-hour ring in New York time, midnight at the top, clockwise. The regular session 09:30–16:00
  is a solid ink arc. Extended hours (04:00–09:30, 16:00–20:00) are a thin ink arc. The weekend (Fri 20:00 →
  Sun 20:00 ET) is an empty hairline ring. The needle is in ink, with the centre label `FRI 16:00 ET` over
  `OPEN / EXTENDED / CLOSED`, plus 7 day pips.
- **The limit bar:** max new-borrow LTV. OPEN 50%, EXTENDED 40%, CLOSED 30% decaying linearly to 20% over 64 h from
  Fri 20:00 (so about 22.5% by Sun 20:00). A fixed red line at 65% is labelled "Liquidation 65% · never moves". Drive
  the dial and the bar from one pure function of ET time.
- **The theme flip is the signature transition.** When the needle crosses into the closed weekend, a black circle
  grows from the dial's centre until it fills the frame (market closes → black). At the open, a white circle grows
  back. Use it wherever a beat changes session; elsewhere, cut or use restrained motion.
- The dial lives in one component (`SessionDial`), reused by every scene that needs it, at any size.

## Motion language
- **Easing:** entrances use ease-out expo `Easing.bezier(0.16, 1, 0.3, 1)` over 14–22 frames. Camera moves use
  ease-in-out cubic. Settles use springs (damping ~200, no bounce). The **only** overshoot in the film is the
  SessionLimit stamp (beat 5).
- **Secondary motion matters** (see the skill): staggered reveals, numbers counting to their real value, lines
  drawing on, subtle parallax, and a slow camera push through each hold. No slideshow feel. Plan
  component-to-component continuity between shots inside a beat.
- **Pacing:** calm and confident. Hold each key state long enough to read (≥ 1.5 s), and every number ≥ 2 s.
- **Craft checks:** check intermediate poses. No text collisions, no half-faded remnants over glyphs, no clipped
  labels.

## Beats (durations from VO_SCRIPT.md; the direction there is authoritative)
1. **The gap (12 s), white.** A big `~$91.5M` counts up. "tokenized stocks on X Layer" · source. Then
   `0 accepted by Aave on X Layer` · source (getReservesList, 25 Sep 2026).
2. **Why it's hard (16 s), white → black.** "Bybit · Kraken · Bitget" in plain type (no logos) with the source
   "spotedcrypto.com · Jun–Jul 2026". Then the NVDA / NVDAx pair: NVDA's real last Friday print 142.60 (Dukascopy,
   24 Jan 2025) goes still; NVDAx shows onchain activity with **no price**. The dial runs into the weekend and the
   black flip happens. Then "Issuer · max order: $0" (xStocks API, 25 Sep 2026).
3. **Intatto (24 s), white → black.** "Intatto" lands first, then the dial and limit bar run a week: 50 → 40 → 30 →
   toward 20, while the 65% red line never moves. The flip to black comes as the needle enters the weekend.
4. **It's live (12 s), white.** A floating browser frame with the real mainnet Borrow footage, then the real OKLink
   footage: push in on the borrow row and the "Contract source code verified" tab. LIVE chip.
5. **Make it Saturday (25 s), white → black.** The dial spins from Friday to Saturday with the black flip. The real
   sandbox footage, a `SessionLimit` stamp landing (the one overshoot, a 2 px shake), then the repay confirmation.
   SANDBOX chip.
6. **The real weekend (15 s), black.** The real Dukascopy minute chart draws itself, Friday afternoon → the weekend
   gap → Monday, with −12.47% at the open. The LTV meter climbs and settles at 59.57%, under the red 65% line.
   "0 liquidations". REPLAY + SANDBOX chips.
7. **The worst case (18 s), black.** SYNTHETIC. One bounded slice sold (19.966 wNVDAx for 2,037.58 USDG, floor
   held). The reserve tank drains 149.10 → 0. The lender loss lands: 147.69 USDG, share value 1.000008 → 0.997054.
8. **Don't trust us (9 s), black → white.** Two columns, X Layer mainnet and the sandbox fork, slide together; four
   real rows lock with green ticks (block 71,563,431 hash, NVDAx bytecode, USDG totalSupply, CollateralMarket
   bytecode, from `src/motion/data/proof.json`). "Snapshot · 25 Sep 2026 14:41 UTC". The flip back to white as they lock.
9. **Agents and the keeper (12 s), white.** An agent's question "How much can 0x7F23…a415 borrow right now?" and the
   answer card from the real `src/motion/data/credit.json` (session, capacity, liquidation price). Then the
   keeper's heartbeat: one pulse per real post from `keeper.json` / OKLink footage, with real timestamps.
10. **Close (8 s), white.** "Intatto", "Live on X Layer mainnet", `intatto.larinova.com`. Hold 2.5 s. Quiet and exact.

## Real data and footage
- Data (verified, read-only): `film/remotion/src/motion/data/*.json`: `nvda-minute-bars.json` (630 real bars,
  Fri 24 Jan 2025 from noon + Mon 27), `recorded-run.json`, `proof.json`, `credit.json`, `keeper.json`,
  `mainnet-transactions.json`. The original replay file is `data/replays/nvda-2025-01-gap.json` (780 bars).
- Footage (1440×900, 30 fps, with the marks in `take.json`; list them with `node film/recorder/marks.mjs`):
  `film/raw/borrow-mainnet-*`, `explorer-*` (OKLink, valid), `weekend-*` (sandbox Saturday flow),
  `replays-2026-09-25T11-06-56` (January + synthetic + Lend), `agents-*`, `keeper-explorer-*` (OKLink keeper posts,
  valid). These show the current UI. The app's screens are being redesigned and the UI inserts get re-shot after
  the 19:30 UTC freeze, so keep the footage in swappable components (take + mark + offset props).

## Project and ownership
- `film/remotion` (Remotion 4.0.529, npm). Grok's v1 files are broken and not to be reused as-is (see
  GROK_REVIEW.md). **cg-motion-lead** moves them, without deleting anything, into `src/_archive_grok_v1/`, keeping
  the same relative paths, and excludes that folder from the bundle and `tsconfig`. Only the review's KEEP/FIX timing
  files stay in place.
- All new code goes in `src/v3/`. The shared files are owned by **cg-motion-lead**: `src/v3/theme.ts` (tokens, fonts,
  easing), `src/v3/dial/*` (SessionDial, LimitBar, session math, ThemeFlip), `src/v3/ui/*` (Chip, SourceLine,
  FloatingFrame, Caption). Others import them and never edit them; if you need a change, message the lead.
- Every beat is a composition `Beat01` … `Beat10` (1920×1080, 30 fps, duration from the script) registered in
  `src/Root.tsx` (owned by cg-motion-lead) under the folder "v3". Each helper registers its beats in its own file,
  `src/v3/compositions-<helper>.tsx`, and the lead includes all three.
- **Captions:** each beat takes a `scratchCaptions` prop (default true for the storyboard clips) that burns the VO
  lines in a quiet lower band, timed across the beat, as a timing aid for Gabriel. The final film turns it off.
- **Render each finished beat** (silent, H.264):
  `npx remotion render BeatNN ../storyboard/presentation/clips/beat-NN.mp4 --codec=h264 --crf=20` and a poster
  `npx remotion still BeatNN ../storyboard/presentation/clips/beat-NN.jpg --frame=<a representative frame>`.
  Keep each mp4 ≤ 6 MB (raise the CRF if needed). Never render a full film.
- **Verify before you report (the skill's rules):** look at stills at the start, middle and settled poses, and the
  frames either side of every cut; check small text at full resolution; watch for collisions. A successful render
  is not proof.
- Work only in `film/`. Never touch product code (`web/`, `contracts/`, `services/`, `checks/`, `tests/`). No git
  commits. No uploads. Keep files under 300 lines. No `console.log` in `src/`.

## Who builds what
- **cg-motion-lead:** archive Grok v1; theme + dial + ThemeFlip + ui primitives **first** (message the others the
  moment their API exists); then Beat01, Beat02, Beat03, Beat10.
- **cg-motion-data:** Beat06, Beat07, Beat08 (charts, tank, hash lock), from the real data JSONs. You may review and
  reuse the Codex chart primitive in `src/motion/chart/` or write your own.
- **cg-motion-ui:** Beat04, Beat05, Beat09 (floating UI footage with camera moves and zoom-to-cursor, the OKLink
  push-ins, the SessionLimit stamp, the heartbeat and the agent Q&A).

Report each rendered clip to the coordinator: `herdr agent prompt cg-film "[from <your-name>] BeatNN rendered:
<path>, <size>, <what you checked>"`. Ask the coordinator about anything that isn't specified here.
