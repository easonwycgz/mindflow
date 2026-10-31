import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
const frozen = "df48c9d2eae22f3fc97487db80ab61b59813adc9";
it("exact frozen implementation reads UX1 backups and UX1 reads frozen backups", () => {
  const result = JSON.parse(
    execFileSync(process.execPath, ["scripts/ux1-backup-compat.mjs"], {
      encoding: "utf8",
    }),
  );
  expect(result).toEqual({
    frozen,
    oldToNew: true,
    newToOld: true,
    exactEnvelope: true,
  });
});
it("preserves authoritative contracts, validator, CSP, independent tests and historical evidence byte-for-byte", () => {
  const files = execFileSync("git", ["ls-tree", "-r", "--name-only", frozen], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");
  const pinned = files.filter(
    (file) =>
      file.startsWith("contracts/") ||
      file.startsWith("docs/") ||
      /^(e2e|tests)\/independent-/.test(file) ||
      file.startsWith("src/generated/") ||
      file === "public/_headers",
  );
  for (const file of pinned)
    expect(readFileSync(file), file).toEqual(
      execFileSync("git", ["show", `${frozen}:${file}`]),
    );
});
