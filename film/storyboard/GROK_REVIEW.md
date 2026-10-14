# Review of the Grok-written film code

Reviewer: cg-film-review (Claude Opus 5.5), 25 Sep 2026, about 20:45 IST. This was a read-only review. The only file I
wrote is this one. I ran the tests on copies in my own scratchpad and changed nothing in `film/remotion`.

## Summary

cg-film-edit built the **v1** film exactly as `BUILD_BRIEF.md` asked: 9 beats, a light Inter look, the v1 cue phrases
and the v1 Close. It kept editing those files at 20:20–20:28, after `MOTION_BRIEF.md` (20:04) and v2 `VO_SCRIPT.md`
(20:05) had landed, but it never moved them to the v2 beat ids. Everything visual is for the retired concept.

The timing infrastructure is good and worth keeping: phrase cues, the edit decision list (EDL) → frames maths, take
import, the voice-over (VO) import and the SRT export. It needs to be moved to v2 and has a few specific bugs.

**The project doesn't bundle at the moment.** `npx remotion compositions` fails with
`Can't resolve './takes.json'`, so neither Studio nor `remotion still` works for any helper, including Codex's motion
scenes. That comes from Grok's `Root.tsx` → `timeline.ts` → `takes.ts` chain.

## Checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **3 errors.** `src/data/takes.ts(1)`: `./takes.json` is missing. `src/lib/cues.ts(2)`: `../data/vo.json` is missing. `src/lib/captions.ts(44)`: `.at()` isn't in `lib: ["es2015"]`. Neither JSON file has been generated. |
| Bundle (`npx remotion compositions`) | **Fails.** Module not found: `./takes.json`. |
| Beat ids | Grok's `types.ts` `BEATS` = `hook, what, mainnet, saturday, proof, replay, synthetic, agents, close` (v1). `script.json` and `vo-scratch.json` (Codex) are v2. The mismatch is hidden by an `as` cast in `cues.ts`. Once the JSON files exist, `VO["hook"]` is `undefined`, so `sceneFrames()` throws and Root crashes. |
| Files over 300 lines | None. The largest is `BrowserFrame.tsx` at 214 lines. |
| `console.log` in `src/` | None. The scripts use `console.log` for command-line output, which is fine. |
| Does `vo-import.mjs` keep the voice local? | **Yes.** It uses ffmpeg plus a local `transcribe()` from `@remotion/install-whisper-cpp`, which runs the local `whisper/main` binary. There is no network call and it doesn't download a model. Temp files go to `/tmp/cg-vo-*.wav`, which is local but not our scratch dir. |
| `import-takes.mjs` offset | **Correct.** `mark.t + take.t0 - first`, where `first = frames[0].t ?? t0`. I checked this against `raw/weekend-2026-09-25T11-00-09/take.json`: `t0` and `frames[].t` are absolute epoch seconds, `marks[].t` is relative to `t0`, and the mp4 is the concat of the frames starting at `frames[0]`. |
| Conflicts with Codex files | There are two themes: `src/theme.ts` (Grok, v1 light) and `src/motion/theme.ts` (Codex, v2). `LabelKind` is defined twice (`data/types.ts` and `motion/theme.ts`, both the same union). Two font sets are loaded: Inter is loaded but isn't in the v2 look. `lib/cues.ts` and `lib/timeline.ts` **don't** duplicate each other: cues maps phrase → VO seconds, and timeline maps EDL → frames and consumes cues. Codex's `src/motion/**` imports nothing from Grok's files. |
| Who wrote `cues.ts` | GROK_REVIEW_BRIEF lists it as Codex's, but the evidence points to Grok. `BUILD_BRIEF §3` assigned it to cg-film-edit. Its mtime (20:20:59) matches Grok's `types.ts`/`edl.ts`/`takes.ts`. It uses Grok's style (double quotes, semicolons) and imports Grok's `types.ts` and the `vo.json` that only Grok's `vo-import` writes. It does **not** implement MOTION_BRIEF's fallback to `vo-scratch.json`. I reviewed it as Grok code. |
| Whisper build | **Works.** `whisper/main` is whisper.cpp v1.5.5, a Mach-O arm64 binary, with `ggml-small.en.bin` (488 MB). Details below. |
| Invented numbers or claims | No invented numbers. Every figure traces to a v1 source line. Two items are retired by v2 or overstated. (1) Close "NEXT: **Chainlink Data Streams live** · more stocks": "live" reads as a present-tense claim, and v2 drops the Next line. (2) FactCards "0 · Venus: stock collateral launched with borrowing switched off · CryptoSlate" has no date and isn't in v2. Close's "Live on X Layer mainnet · contracts verified on OKLink" (plural) is only sourced for CollateralMarket. The EDL's `KEEPER_TX` address `0xaBa1…f808` is the real CLOSE_GUARD_OPERATOR. |

### Whisper test

I ran `public/vo/scratch/01-cold-open.wav` and `04-real.wav`, resampled to 16 kHz mono, through the same `transcribe()`
call `vo-import` uses (small.en, `tokenLevelTimestamps`, the same `--prompt`), then Grok's `wordsFromCaptions` merge.

- **Shape.** Raw tokens are `{ text: " night", startMs, endMs, timestampMs, confidence }`. After the merge: `{ text,
  start, end }` in seconds, for example `Friday[0.12-0.46] night[0.46-0.84] … NVDAx,[5.23-5.92] … USDG,[7.04-7.48]`.
  Punctuation is attached ("York,", "mock-up,"). NVDAx and USDG come out right because of the prompt. Speed is about
  1.5 s for 11 s of audio.
- **Bug: the end of a clip is dropped.** On 01-cold-open, the last words "token doesn't." were missing: the output
  ended at `its[5.87-6.04]` on a 7.05 s file. With 1.5 s of silence padded on, all words came back
  (`token[6.04-6.44] doesn't.[6.44-7.04]`). `vo-import` trims each tail to ~0.2 s *before* whisper, so Gabriel's
  lines will hit this. That's exactly the "Hold on 'Its token doesn't.'" cue.
- **Bug: `[BLANK_AUDIO]` comes through as a word.** With padding, whisper emits `[BLANK_AUDIO][7.81-17.04]` (with an
  impossible end time), and `wordsFromCaptions` keeps it.
- **Cue alignment is good.** I fed the real whisper words into a scratch copy of `cues.ts`. All 7 phrases landed on
  the right word ("Its token doesn't" 5.87, "Here's the transaction" 7.48, "on a verified contract" 9.19, …) with 0
  warnings, including across "mock-up" and "Here's".

## Decision per file

| File | Decision | Defects / reason |
|---|---|---|
| `src/lib/cues.ts` | **FIX** | The alignment is solid (see the test). (1) It hard-imports `../data/vo.json`, so it can't compile until that exists. Make it fall back to `vo-scratch.json` (`words: null`) → char estimate, as MOTION_BRIEF specifies. (2) Import `BeatId` from a v2 source. (3) `cueSeconds` matches only the *first* occurrence of a phrase: "real" appears twice in beat 4, so cues must be multi-word. Document that. (4) `warnings` is module state that `check-edl` reads. Fine, keep it. |
| `src/lib/timeline.ts` | **FIX** | The maths is right: `trimBefore = sourceStart·fps − fadeIn·rate` pre-rolls the crossfade, `continue` resumes a take from the previous segment's source out, and `beatStartFrame`/`filmFrames` subtract the scene overlap correctly. (1) `TIMELINE` hardcodes 7 v1 footage beats: derive it from the EDL keys. (2) `realize`'s `continuity()` closure is convoluted: pass `prev` explicitly. (3) It imports timing constants from the v1 `src/theme.ts`. (4) `labelsFor` uses only the first segment's label: a beat that mixes LIVE and SANDBOX footage would carry the wrong label. |
| `src/data/types.ts` | **FIX** | Keep `Segment`, `Focus`, `VoWord`, `VoBeat`, `TakeFile`. Replace `BEATS`/`FOOTAGE_BEATS` with the 10 v2 ids. Take `LabelKind` from `motion/theme.ts` so there's a single definition. |
| `src/data/takes.ts` | **KEEP** | 4 lines. It only needs `import-takes` to have run, or a committed empty `{}` `takes.json` so the bundle works before footage exists. |
| `src/data/edl.ts` | **FIX** | The format (`take, mark, offset, cue, rate, url, label, with, focus, fallback, continue`) is good. Every row is v1: none of its cue phrases ("Thirty-six", "drops below thirty", "These checks run", "SessionLimit", …) appear in the v2 script, so they would all warn and sit at 0 s. Rewrite the rows against v2 lines and the RESHOOT marks. `/risk#keeper` is unverified as an anchor on the reworked UI. |
| `src/data/take-pins.json` | **DISCARD** once the re-shoot lands | It only aliases old-UI mark labels. Keep the `aliases`/`stamp` mechanism in `import-takes`. |
| `scripts/import-takes.mjs` | **FIX** | The offset is correct (see above). (1) `CUTOFF = 2026-09-25T19:30:00Z` matches BUILD_BRIEF's "19:30 UTC" literally, but take stamps are UTC and the freeze was 19:30 **IST**. The IA rework commits are 20:25–20:28 IST = ~14:58Z. At 19:30Z (01:00 IST on the 26th), every take shot tonight gets flagged "OLD UI". cg-film should confirm the intended instant. (2) It doesn't remove stale files: `public/takes/*T11-..-..mp4` (8 files, ~35 MB) are orphans that nothing references. (3) The `NAMES` list should include the new fork-proof take from RESHOOT (currently `proof`, which has no raw take yet). (4) After the recorder's 2× capture upgrade, check that the `take.json` shape is unchanged. |
| `scripts/vo-import.mjs` | **FIX** | Local only (good). (1) `BEATS` is v1, so with Gabriel's `01-cold-open.mp3`… nothing matches `01-hook`, `gabrielSources()` returns `{}`, and it throws `no voice-over for hook`. (2) The scratch path is `public/vo/scratch/<id>.wav`, but Codex's v2 files are `NN-<id>.wav`. (3) `splitLong` expects 9 chunks; v2 needs 10. (4) Pad ~1.5 s of silence onto the 16 kHz copy before whisper, or the last words are lost (tested). (5) Filter `[…]` tokens such as `[BLANK_AUDIO]`. (6) It writes `estimateWords()` into `vo.json` as if they were real word timings, so `cues.ts` treats estimates as measured and `check-edl` shows 0 warnings. Write `words: null` (or `estimated: true`) until whisper finishes. (7) `waitForWhisper` polls for up to 20 min for a parallel install. Now that the build exists, just check once and fail. (8) Update the prompt for v2 (add DeepSeek, Aave; drop Chainlink). (9) Use the scratchpad instead of `/tmp`. |
| `scripts/check-edl.ts` | **KEEP** | A good gate: it flags freezes, placeholders and cue fallbacks, and exits 1 on freezes or warnings. It works unchanged once the timeline is v2. |
| `scripts/export-srt.ts` | **KEEP** | Writes `out/intatto-demo.srt`, which is gitignored. |
| `src/lib/captions.ts` | **FIX** | The paging and SRT logic are fine and the SRT origin accounts for overlaps. (1) `.at()` fails tsc under `lib es2015`: use `[length-1]`, or raise `lib`. (2) It depends on `VO[beat].words` being non-null. |
| `src/components/Captions.tsx` | **FIX** | The logic is fine. The styling is v1: `#121212` ink would be invisible on the v2 `#0A0F1C` ground, it uses Inter, and `top: 968` + 2×36 px puts the bottom at ~1040, inside the v2 100 px bottom safe margin. Restyle it with `motion/theme` and move it to `src/film/`. |
| `src/components/SceneAudio.tsx` | **KEEP** | Correct. VO lead 15 f > 12 f overlap, so VO never overlaps. It moves with the timing constants. |
| `src/components/BrowserFrame.tsx` | **FIX** (extract) | Keep the clip engine: per-segment `Sequence` + `Video` (trim, rate, muted), the 4-frame crossfade, the focus zoom, the TO RECORD placeholder and the ×N chip. Turn it into a `FootageTrack` that renders *inside* cg-film-motion's `FloatingFrame`. Drop the light chrome and shadow. Clamp the focus pan so a zoom near an edge doesn't show the background. Check one still on a ×4 segment to confirm `trimBefore` + `playbackRate` sync. |
| `src/components/LabelChip.tsx` | **DISCARD** | v1 light style. v2 label styles live in `motion/theme.ts` `labels`. The `OldUiFlag` is a dev marker and must never reach a final cut. |
| `src/components/FactCards.tsx` | **DISCARD** | A v1 Hook beat. v2 beat 2 uses a `maxOrderFiatValue: 0` readout and 405 dots instead. |
| `src/components/WeekChart.tsx` | **DISCARD** | v1 Hook schematic. The v2 cold open uses real NVDA ticks and the dial. |
| `src/scenes/Hook.tsx`, `TitleCard.tsx`, `beats.tsx`, `Close.tsx` | **DISCARD** | v1 beats, v1 cues (all would fall to 0 s), v1 look. Close has the "Chainlink Data Streams live" Next line and the v1 tagline. v2 Close is cg-film-motion's `motion/scenes/Close.tsx`. |
| `src/scenes/FootageScene.tsx` | **DISCARD** | A v1 wrapper. The same composition (label + footage + captions + audio) gets rebuilt in `src/film/` around Codex's scenes and `FloatingFrame`. |
| `src/Film.tsx` | **DISCARD** (rewrite in `src/film/`) | 9 v1 scenes with 12-frame fades. v2 needs 10 beats, a persistent `DialTrack` above the scenes and dial-driven transitions. The overlap maths it relies on stays in `timeline.ts`. |
| `src/Root.tsx` | **DISCARD** (rewrite) | MOTION_BRIEF gives Root to cg-film-motion. It must register `src/motion/compositions.tsx`, `src/motion/data/compositions.tsx` and `src/film/compositions.tsx`. The current Root registers only v1 scenes, and its import chain is what breaks the bundle for everyone. |
| `src/theme.ts` | **DISCARD** after the split | The v1 light palette and Inter duplicate `motion/theme.ts`. Keep only the timing and frame constants (`FPS, WIDTH, HEIGHT, LEAD, TAIL, CLOSE_TAIL, SCENE_FADE, FRAME`) in a new `src/film/timing.ts`. `LABEL_COPY` strings are accurate and can move there too. |
| `tsconfig.json` | **KEEP** | `module: Preserve`, `moduleResolution: Bundler`, `resolveJsonModule` are right. Optionally raise `lib` to `es2022` for `.at()`. |
| `package.json` | **FIX** | `@remotion/install-whisper-cpp` is `^4.0.529` (installed 4.0.529) while every other Remotion package is pinned exactly. Pin it, as `npx remotion add` would. The `tsx` dev dependency and the four scripts are fine. |
| `whisper/` (551 MB) | **KEEP**, with conditions | It works (tested). It sits untracked and **not gitignored** inside `film/remotion` (the whole dir is `??`), so a `git add film/` would commit the 488 MB model. Add `whisper/` to `film/remotion/.gitignore`, or move it out of the repo and point `whisperPath` there. Most of the 551 MB is the source tree, `.git` and test models. Only `main` and `ggml-small.en.bin` are used. |
| `storyboard/presentation/draft-grok.html` | **DISCARD** | It holds only a comment saying nothing was written. |
| `public/vo/scratch/{hook,what,…,close}.wav` | **DISCARD** | v1 scratch VO next to Codex's v2 `NN-<id>.wav`. The path isn't listed in the brief, but it's Grok-era output. |

## Recommendation

**Reuse for the timeline infrastructure once production resumes.** Move these to v2 ids under `src/film/`:
`lib/cues.ts` (plus the `vo-scratch.json` fallback), `lib/timeline.ts`, the `Segment`/`VoBeat`/`TakeFile` types,
`takes.ts`, `edl.ts`'s format (new rows), `lib/captions.ts`, `SceneAudio`, the clip engine from `BrowserFrame`
as `FootageTrack` inside `FloatingFrame`, `check-edl`, `export-srt`, `import-takes` (fix the cutoff and stale-file
cleanup) and `vo-import` (v2 beats, tail padding, `[…]` filter, no estimates written as real timings). Keep the
whisper build, gitignored.

**First unblock, cg-film's call:** the bundle is broken for every helper until Root stops importing the v1 chain, or
until `src/data/takes.json` and `src/data/vo.json` exist.

**Delete, with Gabriel's OK:** `Hook.tsx`, `TitleCard.tsx`, `beats.tsx`, `Close.tsx`, `FootageScene.tsx`, `Film.tsx`,
`Root.tsx` (replace it), `FactCards.tsx`, `WeekChart.tsx`, `LabelChip.tsx`, `src/theme.ts` (after moving its
constants), `take-pins.json` (after the re-shoot), `draft-grok.html`, the v1 scratch wavs, and the 8 orphan
`public/takes/*T11-*.mp4` files.
