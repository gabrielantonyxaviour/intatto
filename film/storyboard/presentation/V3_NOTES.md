# Storyboard v3: Gabriel's feedback (from cg-film)

Gabriel reviewed v2. His words:

> "Our app has an entirely white-and-black theme, and our demo video should have that theme and vibe as well. It
> could be fully dark or fully white, and it can switch between the two colors as the video's theme. We can still
> use some colors. The primary colors are white and black."
>
> "[The opening] feels so dramatic, but it does not feel like a hook, sounds so AI-generated, and is not engaging at all."
>
> "We need to be concise, clear, and more conversational, rather than like a narration or an advertisement."

## 1. Look: black and white, like the app
- **Primary colours are black and white.** Ground is pure white `#FFFFFF` or near-black `#0A0A0A`. Text is the
  opposite. Neutral greys only for secondary text and hairlines (`#737373` / `#A3A3A3`, borders `#E5E5E5` on
  white and `#262626` on black). Remove the navy, the amber and the steel.
- **Colour is allowed but rare, and only when it means something:** red `#E5484D` for loss, refusal and the 65%
  liquidation line; green `#30A46C` for pass/verified ticks. Nothing decorative. The honesty labels (SANDBOX /
  REPLAY · CFD data / SYNTHETIC) become black-and-white outlined chips; SYNTHETIC may use the red outline.
- **The theme switch is the motif.** Market open means a white frame; market closed means a black frame. The session
  dial drives the flip: when the needle crosses into the closed weekend, the frame inverts to black, and at Monday's
  open it inverts back to white. Per beat (v3 script): 1 white; 2 goes black; 3 flips white → black with the dial;
  4 white; 5 flips to black at "Let's jump to Saturday"; 6 black; 7 black; 8 black → white as the proof locks; 9 white;
  10 white.
- **Show the flip in the page itself:** each beat card's mockup frame uses its beat's theme, the hero dial animation
  inverts its frame as it enters the weekend, and the timeline gets a TONE/THEME lane that shows white/black blocks
  per beat.
- **Type matches the app:** the system UI stack, as the app uses it
  (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`), and
  `ui-monospace, SFMono-Regular, Menlo, monospace` for numbers and hashes. Drop Instrument Serif and the Google
  Fonts import entirely. Hierarchy comes from weight and size, not a display serif.
- **The dial in monochrome:** the ring is a hairline; the regular session is a solid arc in the ink colour; extended
  hours are a thinner or dashed arc; the weekend is an empty ring. The needle is in the ink colour. The limit bar
  fill is ink, and the 65% line is red.
- The page stays one committed design (not theme-aware), but it's allowed to alternate white and black sections. Put
  every colour on `:root` as tokens, with an explicit body background.

## 2. Script v3 (`film/storyboard/VO_SCRIPT.md`, draft awaiting Gabriel's OK)
- Replace every VO block with the v3 lines verbatim, plus the new beat titles and the on-screen direction in italics
  under each beat.
- Update the durations (12 / 18 / 20 / 12 / 25 / 15 / 18 / 9 / 12 / 12 s, ≈ 2:33 of beats; the header says about 2:50 with pauses).
- Beat 1 mockup: white frame. "Intatto", then the NVDA / NVDAx pair: the NVDAx side shows activity (no price), the
  NVDA side is still. No "Friday night" text.
- Beat 2 mockup: black. The weekend band, the issuer readout "max order: $0", then the real DeepSeek gap on the
  chart (−12.47%). **Remove the 405-dot field and every Ventuals/Venus reference** (cut from the script).
- Beat 10: remove "Your loan, intact" and "Italian for intact". The close is the two sourced numbers, then
  "Intatto" and intatto.larinova.com.
- On-screen text stays short, with no slogans. Numbers carry the weight.

## 3. Keep
The real data (chart, proof rows, recorded-run numbers), the honesty labels, the music routes section, reduced-motion
behaviour, the 400px layout, and the page contract.
