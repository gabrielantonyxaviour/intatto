# Storyboard v2: directing notes (from cg-film, the video lead)

Edit `film/storyboard/presentation/index.html` in place. v1 is published; cg-film republishes after review. Keep
everything that works. These are targeted fixes, not a redesign. Gabriel's own feedback will be added below as it
arrives, and it outranks these notes.

## Fixes

1. **Beat 1: the picture matches the voice.** The VO now says "Friday night in New York. The last trade prints, and
   NVIDIA stops trading until Monday." The frame still says "Friday. Four p.m." Change the on-screen chapter line to
   "Friday night · New York". Label the 142.60 print as the regular-session close ("FRI CLOSE · 16:00 ET"; it is
   Dukascopy's 15:59 ET bar), and let the corner dial run 16:00 → 20:00, where the ring goes dark with "CLOSED until
   Monday". The NVDAx side stays a pulse with no price.

2. **The dial stages must follow the session rules.** v1 shows "MON 08:00 · CLOSED · 20.6%". Monday 08:00 ET is
   pre-market, so it's EXTENDED at 40%. The weekend is Fri 20:00 → Sun 20:00 ET, and CLOSED decays 30% → 20% linearly
   over 64 h from Fri 20:00, so it reaches about 22.5% by Sun 20:00. Use these stages (needle angle = hours × 15°,
   midnight at the top):
   - FRI 15:00 · OPEN · 50% · 225°
   - FRI 18:00 · EXTENDED · 40% · 270° (amber arc at 35%)
   - FRI 20:00 · CLOSED · 30% · 300° (whole ring steel)
   - SAT 12:00 · CLOSED · 27.5% · 180°
   - SUN 18:00 · CLOSED · 22.8% · 270°, labelled "falling toward 20%"
   - MON 09:30 · OPEN · 50% · 142.5° (the arc relights: "relaxes at dawn")

   If there's room, add a small ring of 7 day pips (MON–SUN) that lights the current day.

3. **Beat 8: use the real values.** `film/remotion/src/motion/data/proof.json` has real, matching values from a live
   sandbox fork versus X Layer mainnet (retrieved 25 Sep 14:41 UTC, 7/7 equal): the fork block 71,563,431 hash
   `0x39cd86…c039`, the bytecode keccak for NVDAx, wNVDAx, pool, USDG and CollateralMarket, and USDG totalSupply.
   Show 4–5 of those rows with the real truncated values in both columns (`0x39cd86…c039` = `0x39cd86…c039`), then
   the ticks. Note its scope in small text: "selected checks; the browser proof page runs the full set".

4. **Beat 10: correct at rest.** The dial's static markup says FRI 15:00 until the script runs. Make the static text
   and needle MON 09:30 · OPEN, so thumbnails and reduced motion are right.

5. **Reduced motion:** don't hide the 405-dot field. Show it as a static, clearly separate inset ("SEPARATE EVENT ·
   Ventuals, 5-for-1 split · 405 liquidated"), so reduced-motion viewers still see it.

6. Remove the stray `<meta name="viewport">` inside the page. The publishing skeleton already provides it.

7. Keep the chart source as it is (the original 780-bar replay file, downsampled). Say so once in the data panel.

## Gabriel's feedback
(pending)
