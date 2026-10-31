import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { importCard, MindDB } from "../src/db";
import { InputIssue, parseJSON, validateCard } from "../src/model";
import {
  quickLayer,
  codepoints,
  sourceDescription,
} from "../src/readingPresentation";
import { explainImport } from "../src/importFeedback";
import { syntheticCard, legalCases, invalidCases } from "./fixtures/ux1";
let db: MindDB;
beforeEach(() => {
  db = new MindDB(crypto.randomUUID());
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
const snapshot = async () => ({
  cards: await db.cards.toArray(),
  reading: await db.reading.toArray(),
  settings: await db.settings.toArray(),
});
async function setup() {
  await importCard(JSON.stringify(syntheticCard()), db);
}
it.each(Object.entries(legalCases))(
  "synthetic legal %s retains exact protocol content",
  (_, value) => {
    expect(validateCard(value)).toBe(value);
  },
);
it.each(invalidCases())(
  "rejects $name without writing any store",
  async ({ value, code }) => {
    await setup();
    const before = await snapshot();
    await expect(importCard(JSON.stringify(value), db)).rejects.toMatchObject({
      code,
    });
    expect(await snapshot()).toEqual(before);
  },
);
it("syntax/capacity/value limits and duplicate content are explanatory and never expose JSON", async () => {
  for (const [text, code] of [
    ["{bad", "syntax"],
    [" ".repeat(2 * 1024 * 1024 + 1), "capacity"],
  ] as const) {
    let issue: unknown;
    try {
      parseJSON(text);
    } catch (e) {
      issue = e;
    }
    expect(issue).toMatchObject({ code });
    expect(explainImport(issue).kind).toBe("error");
  }
  expect(() => parseJSON(JSON.stringify(Array(50001).fill(1)))).toThrow(/数量/);
  const c = syntheticCard();
  await importCard(JSON.stringify(c), db);
  try {
    await importCard(JSON.stringify(c), db);
  } catch (error) {
    expect(explainImport(error).kind).toBe("duplicate");
  }
  expect(explainImport(Error(JSON.stringify(c))).detail).toBeUndefined();
  expect(
    explainImport(new InputIssue("version", "schema_version const")).title,
  ).toContain("版本");
});
it("quick layer uses complete author order, avoids duplication and handles Unicode and long degradation", () => {
  for (const card of Object.values(legalCases)) {
    const quick = quickLayer(card);
    expect(quick.core).toBe(card.key_takeaways[0]);
    expect(quick.points).toEqual(card.key_takeaways.slice(1, 3));
  }
  expect(quickLayer(legalCases.one).points).toEqual([]);
  expect(quickLayer(legalCases.two).points).toHaveLength(1);
  expect(quickLayer(legalCases.twelve).points).toHaveLength(2);
  expect(quickLayer(legalCases.long).longCore).toBe(true);
  expect(codepoints("🧪中")).toBe(2);
});
it("source metadata combinations explain absence without accepting invalid source", () => {
  expect(sourceDescription(legalCases.one.source)).toContain("不代表");
  expect(sourceDescription(legalCases.titleSource.source)).toContain(
    "未提供原对话链接",
  );
  expect(sourceDescription(legalCases.urlSource.source)).toContain(
    "未提供原对话标题",
  );
  expect(sourceDescription(legalCases.bothSource.source)).not.toContain(
    "未提供",
  );
});
