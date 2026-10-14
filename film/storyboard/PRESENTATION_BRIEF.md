# Brief: the Intatto film storyboard as an HTML presentation

Audience: Gabriel. He must SEE the whole production before approving: every beat, every visual element, the motif, the music arc and the timing. Reading text doesn't work for him. Output: ONE self-contained file, `film/storyboard/presentation/index.html`. okx-claude publishes it as a claude.ai artifact.

## What the page shows
1. **Opener:** the concept line, "The market sleeps. The token doesn't.", with a LIVE animated session dial as the hero. A 24h ring, the NYSE session a bright arc, nights and weekends dark. A needle turns, and beside it a borrow-limit bar tightens (50 → 40 → 30 → 20%) as the needle enters the dark, while a fixed 65% liquidation line never moves. This is the motif of the whole film, so make it real and animated (Canvas or SVG plus JS).
2. **A full timeline strip** of the 10 beats with durations (from VO_SCRIPT.md), a tone band (tension for beats 1-2, then calm and confident, then the uplift at the close) and the music arc under it.
3. **One section per beat (10):** an ANIMATED mini-mockup of the shot in a 16:9 frame, built in CSS, SVG or Canvas and looping. For example:
   - Beat 1: a ticker freezing at a closing bell while an onchain price keeps ticking.
   - Beat 2: a weekend darkness band, then a Monday gap cracking a price line, then 405 dots bursting.
   - Beat 3: the dial and the limit bar.
   - Beat 4: a floating browser frame with a camera push-in to a tx hash.
   - Beat 5: the dial spinning forward, then a SESSIONLIMIT stamp landing.
   - Beat 6: an NVDA chart drawing itself, and an LTV meter rising and stopping at ~60 under a 65 line. Use the REAL Dukascopy minute bars in data/replays if they're small enough; downsample them.
   - Beat 7: slices peeling off, a reserve tank draining to 0, a lender-loss chip.
   - Beat 8: two hash columns sliding together and locking, then 4 checks.
   - Beat 9: a keeper heartbeat pulse and an agent question/answer bubble.
   - Beat 10: the dial coming to rest, then the wordmark and URL.
   Next to each: the VO lines, the on-screen text, a camera and transition note, SFX cues, and whether it's motion graphics, a UI recording or both.
4. **"Production elements" section:** the motif system, type choices, palette, real-data-driven graphics (list the data sources), the UI capture approach (2x, zoom-to-cursor), the music plan (options pending from MUSIC_OPTIONS.md; show as TBD with the intended arc) and SFX.
5. **Open decisions** for Gabriel: music pick, anything else.

## Page contract (hard rules; the publish fails or breaks otherwise)
- Write page content only: no <!doctype>, <html>, <head> or <body> tags. Start with <title>Intatto Film Storyboard</title> and a <style>.
- External scripts only from cdnjs.cloudflare.com (pinned exact version, UMD) or cdn.jsdelivr.net/npm; fonts only from Google Fonts with fallback stacks. Everything else is inlined. No iframes, no fetch to other hosts, no alert/confirm.
- Theme: define every colour as a token on bare :root. The film is dark and cinematic, so commit to ONE dark look: set `color-scheme: dark` on :root and an explicit body background. No media or data-theme blocks are needed.
- Responsive to 400px wide: a 16px side gutter on the outer wrapper (padding-block for vertical), frames with max-width:100% and aspect-ratio 16/9, sections stacking to one column, no horizontal page scroll.
- Respect prefers-reduced-motion (show a still frame). The page must look complete at rest: nothing is left at opacity 0 waiting for scroll.
- Avoid generic AI looks: no purple-blue gradient hero, no Inter or Space Grotesk, no emoji, no everything-centred. Suggested: a deep ink-navy ground, one warm "market bell" amber for the session arc, a cool steel for night, semantic red and green only for loss and pass. Type: a characterful display face (e.g. "Instrument Serif" or "Fraunces") used sparingly, a clean body face (e.g. "IBM Plex Sans"), and a mono face for hashes and numbers (e.g. "JetBrains Mono").
- Use real content from VO_SCRIPT.md, SHOT_LIST.md and the sources table. No lorem ipsum.
- Under 2 MB total.

When done, ping okx-claude with the path. Don't publish it yourself.
