# Review brief: what the Grok sessions wrote (read-only review)

Gabriel's rule: no Grok on motion or video work. Anything a Grok session wrote must be reviewed by a Claude Opus 5.5
high-effort session before it's reused. You are that reviewer. **Review only: don't edit, move or delete any file.**
Write one report: `film/storyboard/GROK_REVIEW.md`.

## Context
- Project: `film/remotion` (Remotion 4.0.529). Briefs: `film/storyboard/BUILD_BRIEF.md` (Grok's original brief) and
  `film/storyboard/MOTION_BRIEF.md` (the current concept, look, file ownership and hard rules). The script is
  `film/storyboard/VO_SCRIPT.md` v2 (10 beats).
- The concept has changed since Grok started: v1 had 9 beats; now it's 10, with the session-dial motif. Production is
  paused until Gabriel approves the storyboard.
- **Written by cg-film-edit (Grok 4.7)**, to be reviewed: `scripts/check-edl.ts`, `scripts/export-srt.ts`,
  `scripts/import-takes.mjs`, `scripts/vo-import.mjs`; `src/components/{BrowserFrame,Captions,FactCards,LabelChip,SceneAudio,WeekChart}.tsx`;
  `src/data/{edl.ts,take-pins.json,takes.ts,types.ts}`; `src/Film.tsx`; `src/Root.tsx`; `src/lib/{captions.ts,timeline.ts}`;
  `src/scenes/{beats.tsx,Close.tsx,FootageScene.tsx,Hook.tsx,TitleCard.tsx}`; `src/theme.ts`; `tsconfig.json` and
  `package.json` changes; the local whisper.cpp build in `film/remotion/whisper/` (551 MB). The two Grok sessions
  cg-film-motion and cg-film-pres wrote nothing, except `film/storyboard/presentation/draft-grok.html`, which is a
  comment only.
- **Written by Codex (cg-film-data)**, not in scope except where a Grok file collides with it: `src/motion/**`,
  `src/lib/cues.ts`, `src/data/script.json`, `src/data/vo-scratch.json`, `scripts/vo-scratch.mjs`, `public/vo/scratch/*`.

## For every Grok file, decide one of
- **KEEP**: correct, matches the current brief, reusable as is.
- **FIX**: worth keeping; list the exact defects.
- **DISCARD**: wrong scope (for example visual scenes for the retired v1 concept), wrong approach, or unsafe.

Check at least these:
- `npx tsc --noEmit` (report, don't fix).
- Conflicts with the Codex files (for example two `theme.ts`, or `cues.ts` vs `lib/timeline.ts` doing the same job).
- Does `vo-import.mjs` keep Gabriel's voice local (no cloud API)?
- Does `import-takes.mjs` handle the video-time offset correctly (`mark.t + t0 - frames[0].t`)?
- Invented numbers or claims in any scene.
- Files over 300 lines, and `console.log` left in `src/`.
- Whether the whisper build works: run its binary on one scratch wav from `public/vo/scratch/` and report the word
  timestamps' shape.

End with a short recommendation: what to reuse for the timeline infrastructure once production resumes, and what to
delete (cg-film deletes only with Gabriel's OK). When done, report: `herdr agent prompt cg-film "[from cg-film-review] GROK_REVIEW.md written: <one line>"`.
