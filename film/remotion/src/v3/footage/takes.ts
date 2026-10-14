import manifest from "./takes.json";

/** A recorded UI take, from scripts/v3-takes.mjs (film/raw/<name>-<stamp>/take.json). Re-shoots swap in here. */
export type Take = { stamp: string; file: string; seconds: number; marks: Record<string, number> };

const TAKES = manifest as Record<string, Take>;

export const take = (name: string): Take => {
  const t = TAKES[name];
  if (!t) throw new Error(`no take "${name}": run node scripts/v3-takes.mjs`);
  return t;
};

/** Video seconds of `mark` in take `name`, plus `offset` seconds. Throws on a missing mark so a re-shoot that renamed one fails loudly. */
export const markSeconds = (name: string, mark: string, offset = 0): number => {
  const t = take(name);
  const at = t.marks[mark];
  if (at === undefined) throw new Error(`take "${name}" (${t.stamp}) has no mark "${mark}"`);
  return at + offset;
};
