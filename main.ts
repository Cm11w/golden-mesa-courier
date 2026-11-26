// Golden Mesa Courier — the entry program (Node 22, standard library only).
// One job: copy game/ and screenshots/ into /output and write the dossier
// there, so the scorer can verify the game from the dossier alone.
// Deterministic: the same entry directory writes the same /output bytes.
// Round 2: title screen, airmail drops, richer end screen, gentler leg 1.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const ROOT = new URL('.', import.meta.url).pathname;

// /output is a mount point on the grader: removing it wholesale fails with
// EBUSY (a mount point cannot be removed), so only the artifacts this program
// writes are cleared — never the directory itself.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  rmSync(join(OUT, name), { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

for (const name of ['game', 'screenshots']) {
  const src = join(ROOT, name);
  if (!existsSync(src)) throw new Error(`missing ${name}/ in the entry directory`);
  cpSync(src, join(OUT, name), { recursive: true });
}

const dossier = buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(OUT, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes`);
