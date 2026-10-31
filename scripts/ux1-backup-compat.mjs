// Bidirectional executable compatibility with the exact frozen v1 implementation.
// All inputs are fictional. Temporary sources/backups stay outside the repository.
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import "fake-indexeddb/auto";
const frozen = "df48c9d2eae22f3fc97487db80ab61b59813adc9";
const scratch = mkdtempSync(join(tmpdir(), "mindflow-ux1-compat-"));
try {
  symlinkSync(resolve("node_modules"), join(scratch, "node_modules"), "dir");
  for (const file of [
    "src/db.ts",
    "src/model.ts",
    "src/generated/card-validator.js",
  ]) {
    const dest = join(scratch, "frozen", file);
    mkdirSync(resolve(dest, ".."), { recursive: true });
    writeFileSync(dest, execFileSync("git", ["show", `${frozen}:${file}`]));
  }
  async function compile(entry, outfile) {
    await build({
      stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" },
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      outfile,
    });
    return import(pathToFileURL(outfile).href);
  }
  const old = await compile(
    `export * from ${JSON.stringify(join(scratch, "frozen/src/db.ts"))};`,
    join(scratch, "old.mjs"),
  );
  const candidate = await compile(
    `export * from './src/db';export {syntheticCard} from './tests/fixtures/ux1';`,
    join(scratch, "candidate.mjs"),
  );
  const source = new old.MindDB("ux1-old-" + crypto.randomUUID()),
    target = new candidate.MindDB("ux1-new-" + crypto.randomUUID());
  try {
    const card = await old.importCard(
      JSON.stringify(candidate.syntheticCard()),
      source,
    );
    await source.reading.update(card.id, {
      favorite: true,
      section: "tree",
      nodeId: "root-1",
      scroll: 721,
    });
    await source.settings.put({
      ...old.defaults,
      lastCardId: card.id,
      fontSize: "large",
    });
    const v1 = await old.backup(source);
    await candidate.restore(v1, target);
    if ((await candidate.backup(target)) !== v1)
      throw Error("Frozen -> UX1 changed the v1 envelope");
    await target.reading.update(card.id, { section: "faq", scroll: 123 });
    const next = await candidate.backup(target);
    await old.restore(next, source);
    if ((await old.backup(source)) !== next)
      throw Error("UX1 -> frozen changed the v1 envelope");
    process.stdout.write(
      JSON.stringify({
        frozen,
        oldToNew: true,
        newToOld: true,
        exactEnvelope: true,
      }),
    );
  } finally {
    await source.delete();
    await target.delete();
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
