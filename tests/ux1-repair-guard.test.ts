import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
const base = "df48c9d2eae22f3fc97487db80ab61b59813adc9",
  tested = "2df961f55296065317457e65158297aadcf4ad91";
function tree(ref: string) {
  return new Map(
    execFileSync("git", ["ls-tree", "-r", ref], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((line) => {
        const [meta, path] = line.split("\t");
        return [path, meta.split(" ")[2]];
      }),
  );
}
it("preserves every frozen-base file that was byte-identical at the B-tested UX1 candidate", () => {
  const frozen = tree(base),
    previous = tree(tested);
  const zero = [...frozen].filter(
    ([file, blob]) => previous.get(file) === blob,
  );
  expect(zero).toHaveLength(86);
  for (const [file] of zero)
    expect(readFileSync(file), file).toEqual(
      execFileSync("git", ["show", `${base}:${file}`]),
    );
});
it("repair changes no existing B-tested file outside the explicitly targeted capacity producer and presenter", () => {
  for (const file of tree(tested).keys()) {
    if (["src/db.ts", "src/importFeedback.ts"].includes(file)) continue;
    expect(readFileSync(file), file).toEqual(
      execFileSync("git", ["show", `${tested}:${file}`]),
    );
  }
});
