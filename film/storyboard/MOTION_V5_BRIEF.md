# Motion v5 brief: the full film, with creative freedom

From cg-film (the video lead). Script v5.1 is **locked** (`film/storyboard/VO_SCRIPT.md`, 11 beats). Gabriel, 25 Sep:

> "Don't try to pin yourself to a specific particular format of video editing. Be free and think widely. You're the best
> motion designer or animator in the world, able to design and animate production-level product demo videos … you can
> go as wild as possible when you're designing the motion graphic parts of our entire demo video."

This supersedes MOTION_V3_BRIEF's beat list; its look rules and craft rules still apply unless changed below. Read
the script first, then this brief, then `~/.claude/skills/motion-video-quality/SKILL.md` (all of it, including the
new voice-over section).

## What Gabriel asked for (his words, condensed)
- **Black and white like the app; the market session drives it.** A closed market goes black; at the open, black
  turns into white. He loves the flips. Keep them as the signature, but **make every transition unique** and cool.
  Different beats deserve different moves: morphs, match cuts, masks, a dial that becomes a timeline, a number that
  becomes a chart, zoom-throughs, parallax depth, typographic transitions. Never the same wipe twice in a row.
- **The demo travels a week.** Show a 7-day week: time moves to Friday, the camera dives into Friday and we see the
  app screen at that moment; it pulls back out, the clock runs forward (Friday 8 p.m. → black), it dives into
  Saturday; then out again to January 2025 and into Monday's open. **No sandbox controls on screen**: no "Jump to
  Saturday" button, no scenario toggles. The voice-over says we move the clock; the picture shows time travelling.
- **Less on screen at once.** Fewer text containers and chips. Bring one thing in, make it land, move it out. Zoom
  into the number that matters, then pull back. Magic, but never chaotic: clarity first.
- **Beat 4 is a set piece:** the X Layer logo in the centre, the **sandbox fork** on one side and **mainnet** on the
  other, the camera zooming in and out, and the real contract addresses appearing as we reach each side.
- **Under the hood (8) and the model (9):** a few important engineering points, flexed with real market visuals or
  animations of real market things. No edge-case lectures.
- **OKX AI (10) switches the energy.** It's still clean and cool, but different from the black-and-white world (a new
  palette moment, a softer or more luminous surface, different motion rhythm). Its centrepiece is a chat that
  feels as clean as iMessage: a message asks how much a wallet can borrow; the agent visibly calls **Intatto's A2MCP
  service** (a tool-call moment); the real result comes back as a clean card. This shows that any agent can plug into
  Intatto. Minimal text, maximum motion.

## Hard lines (don't cross them, whatever the style)
- **Real data only.** Every number, hash, address and price comes from `film/remotion/src/motion/data/*.json`,
  `deployments/xlayer-mainnet.json`, `okx-ai/credit-service.json`, recorded footage, or the script's sources table.
  Nothing invented. The OKX AI listing is "under review" (agent 13907, A2MCP service "Borrow capacity and health").
- **Honesty stays, quietly.** Simulated material still says what it is, as ONE small, quiet line of type (no boxed
  chips), e.g. "Fork of X Layer mainnet", "Replay · Dukascopy CFD minute data", "Synthetic scenario". Mainnet material
  may say "X Layer mainnet". Keep it on screen while that content is on screen.
- **Logos:** the X Layer / OKX / OKX AI marks only from their official sources (download the official asset; record
  the source URL in `film/remotion/public/brand/SOURCES.md`). Never redraw or distort a brand mark. No exchange logos
  for Bybit/Kraken/Bitget (plain type only).
- **Generated imagery** (Gabriel allows it, via chatgpt.com in the browser): only for mood, texture or abstract
  illustration, never to depict real UI, real data, charts, prices or people. Ask cg-film to run the browser; don't
  drive it yourself.
- Remotion rules from before: files under 300 lines, no `console.log`, tsc clean, work only in `film/`, no commits, no
  uploads, never render the full film. Captions (`scratchCaptions`) follow the v5.1 lines; cues come from
  `src/v3/script.ts`, which the lead updates to v5.1 first.

## Beats and owners
| # | Beat | Owner | Notes |
|---|---|---|---|
| 1 | Hook | cg-motion-lead | Shot A: the dial unrolls into week tracks (NVDAx lit 24/7, NVDA only in session). Shot B: ~$91.5M counts up, "nowhere to borrow". The Aave line is cut from VO; a small source line can stay. |
| 2 | Why it's hard | cg-motion-lead | Exchanges in plain type → Friday 8 p.m. ET, price discovery stops (black) → thin token line → the issuer's $0 → "gap risk". |
| 3 | Intatto | cg-motion-lead | Explain the product visually: tokenized stock in, USDG out, the market clock running under it (more when open, less when closed, rules on open loans unchanged). **No percentages yet.** The existing Beat03 week-chart work can move into a later beat if useful. |
| 4 | Live + forked | cg-motion-ui | The X Layer logo centre set piece: mainnet (real addresses, the live loan) and the fork (block 71,563,431). |
| 5 | Friday | cg-motion-ui | The WeekTimeline dive into Friday afternoon (white) → the new-UI Borrow screen: deposit and borrow within the open limit. |
| 6 | Saturday | cg-motion-ui | Out, the clock runs past Fri 8 p.m. (black), in to Saturday → the limit dropped, the refusal before signing (SessionLimit), the repay. |
| 7 | The real weekend | cg-motion-data | Out to Jan 2025, in to Monday's open: the real chart, the −12.47% gap, the LTV topping out under 65, no liquidations. Far fewer labels than the current Beat06. |
| 8 | Under the hood | cg-motion-data | The keeper price checked against the pool; lending only what the pools can absorb; the gap reserve first, then lenders. One idea per moment, real market visuals. |
| 9 | The model | cg-motion-data | Interest 80% lenders / 20% gap reserve; isolated markets (NVDAx live, SPYx on the fork). |
| 10 | OKX AI | **cg-motion-ai** (new) | The energy switch, the iMessage-clean chat, the A2MCP tool-call moment, the real `credit.json` answer. Agent 13907, under review. |
| 11 | Close | cg-motion-lead | Back to black and white; the week one last time; "Intatto", the URL. Hold 2.5 s. |

**Shared motion system, owned by cg-motion-lead** (build it first and message the API to all): `WeekTimeline`: a
7-day strip in ET with the session bands. It can dive (zoom) into any moment and pull back, and drives the
black/white flip and the dial. Beats 5–7 depend on it.

**Footage re-shoot (cg-motion-ui, first):** the redesigned screens are live (web 96f235c3). Upgrade
`film/recorder/rig.mjs` to 2× capture (`--force-device-scale-factor=2`, verify 2880×1800 frames and the frame rate)
and a per-frame cursor log. Re-shoot, per `film/storyboard/SHOT_LIST.md` but **framed without the sandbox controls in
view**: the mainnet Borrow position (read-only wallet); Friday borrow in a fresh sandbox session (right now it IS
Friday during market hours in New York, so the session opens OPEN); Saturday (do the time jump off-camera, then
record the Borrow page); refusal and repay; the Monday replay views on Risk; the Lend primer; the agents credit call.
Keep every raw take. The selector notes for the new layout: `.abel-work/ia-selectors/*.md`.

## Report
Report each rendered beat to cg-film: `herdr agent prompt cg-film "[from <name>] BeatNN rendered: <path>, <size>,
<what you checked>"`. Render to `film/storyboard/presentation/clips/beat-NN.mp4` plus a settled poster `beat-NN.jpg`.
Beat numbering is now 01–11.
