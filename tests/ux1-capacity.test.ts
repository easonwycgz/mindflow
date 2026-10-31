import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { assertCapacity, importCard, MindDB } from "../src/db";
import { MAX_BACKUP_BYTES, hash } from "../src/model";
import { explainImport } from "../src/importFeedback";
import { capacityCard, capacityLibrary } from "./fixtures/libraryCapacity";
let db: MindDB;
beforeEach(() => {
  db = new MindDB(crypto.randomUUID());
});
afterEach(async () => {
  await db.delete();
});
async function digest() {
  return {
    cards: await hash(await db.cards.toArray()),
    reading: await hash(await db.reading.toArray()),
    settings: await hash(await db.settings.toArray()),
  };
}
async function seed(count: number, large = false) {
  const p = await capacityLibrary(count, large);
  await db.transaction("rw", db.cards, db.reading, db.settings, async () => {
    await db.cards.bulkAdd(p.cards);
    await db.reading.bulkAdd(p.reading);
    await db.settings.put(p.settings);
  });
  return p;
}
it("B-UX1-001: imports 499 and 500, rejects 501 with a stable library business reason and preserves every store", async () => {
  await seed(498);
  await importCard(JSON.stringify(capacityCard(498)), db);
  expect(await db.cards.count()).toBe(499);
  await importCard(JSON.stringify(capacityCard(499)), db);
  expect(await db.cards.count()).toBe(500);
  const before = await digest();
  let issue: unknown;
  try {
    await importCard(JSON.stringify(capacityCard(500)), db);
  } catch (error) {
    issue = error;
  }
  expect(issue).toMatchObject({ code: "library-count", limit: 500 });
  expect(explainImport(issue).title).toContain("500");
  expect(explainImport(issue).title).not.toContain("数据库事务失败");
  expect(await digest()).toEqual(before);
});
it("40MiB: legal cards reach the same capacity branch without changing any limit or committing partial rows", async () => {
  const p = await seed(22, true);
  expect(() => assertCapacity(p.cards)).not.toThrow();
  expect(
    new TextEncoder().encode(JSON.stringify(p.cards)).length +
      p.cards.length * 512 +
      1024,
  ).toBeLessThan(MAX_BACKUP_BYTES);
  const before = await digest();
  let issue: unknown;
  try {
    await importCard(JSON.stringify(capacityCard(22, true)), db);
  } catch (error) {
    issue = error;
  }
  expect(issue).toMatchObject({
    code: "library-bytes",
    limit: MAX_BACKUP_BYTES,
  });
  expect(explainImport(issue).title).toContain("40");
  expect(explainImport(issue).title).not.toContain("数据库事务失败");
  expect(await digest()).toEqual(before);
}, 30000);
it("genuine storage/transaction errors and lookalike messages remain database failures", () => {
  for (const error of [
    new DOMException("quota fault", "QuotaExceededError"),
    Error("知识库最多 500 张卡片"),
    Object.assign(Error("fake business code"), {
      code: "library-count",
      limit: 500,
    }),
  ]) {
    expect(explainImport(error).title).toContain("数据库事务失败");
  }
});
