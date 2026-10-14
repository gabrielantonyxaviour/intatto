import editWords from "./words-edit.json";

/**
 * Gabriel's voice-over (VO_SCRIPT v5.3), timed by whisper on film/vo/gabriel/edit (scripts/vo-words.mjs) and aligned
 * onto the script's own words. `polished` is the same takes with a clean-up pass, so it shares edit's timing; a
 * future `rerecord` gets its own pass (words-rerecord.json) and falls back to edit's timing until then.
 */
export type VoSource = "polished" | "edit" | "rerecord";
export type VoWord = { text: string; start: number; end: number; heard: boolean };
type BeatVo = { file: string; seconds: number; words: VoWord[] };

const EDIT = editWords as Record<string, BeatVo>;
const TIMING: Record<VoSource, Record<string, BeatVo>> = { edit: EDIT, polished: EDIT, rerecord: EDIT };

export const hasVo = (n: number, source: VoSource = "polished") => Boolean(TIMING[source][String(n)]);

/** Length of beat n's voice-over in seconds (undefined before the timing pass has run). */
export const voSeconds = (n: number, source: VoSource = "polished") => TIMING[source][String(n)]?.seconds;

/** Words of beat n with real start/end times (script spelling, whisper timing). Empty before the pass. */
export const voWords = (n: number, source: VoSource = "polished"): VoWord[] => TIMING[source][String(n)]?.words ?? [];

/** The audio file for beat n from `source`, relative to public/ (scripts/vo-link.mjs copies them there). */
export function voFile(n: number, source: VoSource = "polished"): string | undefined {
  return EDIT[String(n)]?.file.replace("/edit/", `/${source}/`);
}

const key = (w: string) => w.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "");
const tokens = (text: string) => text.split(/[\s-]+/).map(key).filter(Boolean);

/** Seconds into beat n's VO where `phrase` starts, or undefined if there are no timings or no match. */
export function voCue(n: number, phrase: string, source: VoSource = "polished"): number | undefined {
  const words = voWords(n, source);
  if (!words.length) return undefined;
  const keys = words.map((w) => key(w.text));
  const want = tokens(phrase);
  for (let i = 0; i + want.length <= keys.length; i++) {
    if (want.every((t, j) => keys[i + j] === t)) return words[i].start;
  }
  return undefined;
}

/** Sentences of beat n with real times, for captions: the script's text, whisper's timing. */
export function voSentences(n: number, source: VoSource = "polished"): { text: string; from: number; to: number }[] {
  const words = voWords(n, source);
  const out: { text: string; from: number; to: number }[] = [];
  let cur: VoWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((w) => w.text).join(" ").replace(/- /g, "-");
    out.push({ text, from: cur[0].start, to: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    if (/[.?!]$/.test(w.text) && !/^[ap]\.m\.$/i.test(w.text)) flush();
  }
  flush();
  return out;
}
