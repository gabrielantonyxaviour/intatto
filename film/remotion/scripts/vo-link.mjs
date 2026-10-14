// Makes Gabriel's voice-over playable by FilmV5 (copies only, no transcoding): every source folder that exists
// (film/vo/gabriel/edit, polished, and a future rerecord) is copied to public/vo/gabriel/<source>/, keeping the
// NN-*.wav names. Beats match by the two-digit prefix. Timing comes from src/v3/vo/words-edit.json (vo-words.mjs).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

for (const source of ["edit", "polished", "rerecord"]) {
  const from = join("../vo/gabriel", source);
  if (!existsSync(from)) {
    process.stdout.write(`${source}: none\n`);
    continue;
  }
  const to = join("public/vo/gabriel", source);
  mkdirSync(to, { recursive: true });
  const files = readdirSync(from).filter((f) => /^\d\d-.*\.(wav|mp3|m4a)$/i.test(f));
  for (const f of files) copyFileSync(join(from, f), join(to, f));
  process.stdout.write(`${source}: ${files.length} files → ${to}\n`);
}
