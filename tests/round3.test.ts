import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import example from "../contracts/mindflow-card-example-v1.json";
import { MindDB, defaults, newReading, type StoredCard } from "../src/db";
import { hash, validateCard } from "../src/model";
import {
  FontWriter,
  patchSettings,
  pendingFont,
  FONT_INTENT_KEY,
} from "../src/settings";
import {
  exportVolumes,
  restoreVolumes,
  type TransferFile,
} from "../src/volumes";
let db: MindDB;
beforeEach(() => {
  db = new MindDB(crypto.randomUUID());
});
afterEach(async () => {
  await db.delete();
});
function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i) => Array.from(data.keys())[i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}
it("R3 settings: concurrent font and last-card patches preserve both; rapid changes converge to latest committed intent", async () => {
  const local = storage(),
    writer = new FontWriter(local, db),
    id = crypto.randomUUID();
  const a = writer.choose("large"),
    b = patchSettings({ lastCardId: id }, db),
    c = writer.choose("normal"),
    d = writer.choose("large");
  await Promise.all([a, b, c, d]);
  expect(await db.settings.get("main")).toEqual({
    ...defaults,
    fontSize: "large",
    lastCardId: id,
  });
  expect(pendingFont(local)).toBeNull();
});
it("R3 settings: failed transaction never acknowledges saved; durable intent retries and clears only after commit", async () => {
  const local = storage(),
    writer = new FontWriter(local, db);
  await db.settings.put(defaults);
  const hook = () => {
    throw Error("synthetic quota failure");
  };
  db.settings.hook("updating", hook);
  await expect(writer.choose("large")).rejects.toThrow("synthetic quota");
  expect((await db.settings.get("main"))?.fontSize).toBe("normal");
  expect(pendingFont(local)?.fontSize).toBe("large");
  db.settings.hook("updating").unsubscribe(hook);
  await new FontWriter(local, db).resume();
  expect((await db.settings.get("main"))?.fontSize).toBe("large");
  expect(local.getItem(FONT_INTENT_KEY)).toBeNull();
});
it("R3 settings: synchronous journal failure is explicit and no DB success is fabricated", async () => {
  const local = storage();
  local.setItem = () => {
    throw Error("journal unavailable");
  };
  expect(() => new FontWriter(local, db).choose("large")).toThrow(
    "journal unavailable",
  );
  expect(await db.settings.count()).toBe(0);
});
async function legacy() {
  const cards: StoredCard[] = [];
  for (let i = 0; i < 501; i++) {
    const content = validateCard({ ...example, title: "Legacy R3 " + i });
    cards.push({
      id: crypto.randomUUID(),
      hash: await hash(content),
      content,
      createdAt: 123,
      updatedAt: 456,
    });
  }
  await db.cards.bulkAdd(cards);
  await db.reading.bulkAdd(
    cards.map((c) => ({
      ...newReading(c.id),
      favorite: true,
      section: "tree" as const,
      nodeId: "b1-1",
      scroll: 88,
    })),
  );
  await db.settings.put({
    ...defaults,
    fontSize: "large",
    lastCardId: cards[500].id,
  });
}
const snapshot = async () => ({
  cards: await db.cards.toArray(),
  reading: await db.reading.toArray(),
  settings: await db.settings.toArray(),
});
it("R3 migration: valid legacy 501-card database -> all volumes -> empty new DB -> exact content, nodes and references", async () => {
  await legacy();
  const expected = await snapshot(),
    files = await exportVolumes(db);
  expect(files).toHaveLength(3);
  // Every part retains the old formal backup envelope and independently valid references.
  for (const f of files.slice(1)) {
    const envelope = JSON.parse(f.text);
    expect(Object.keys(envelope).sort()).toEqual([
      "checksum",
      "payload",
      "version",
    ]);
    expect(envelope.payload.cards.length).toBeLessThanOrEqual(500);
  }
  await db.transaction("rw", db.cards, db.reading, db.settings, async () => {
    await db.cards.clear();
    await db.reading.clear();
    await db.settings.clear();
  });
  await restoreVolumes(files.toReversed(), db);
  expect(await snapshot()).toEqual(expected);
  expect(await db.cards.count()).toBe(501);
  expect(
    (await db.cards.toArray()).reduce(
      (n, c) => n + c.content.branches[0].children.length,
      0,
    ),
  ).toBe(501);
});
it("R3 migration: missing, duplicate, reordered, mixed and corrupt volumes preserve all destination stores", async () => {
  await legacy();
  const files = await exportVolumes(db),
    expected = await snapshot();
  const invalid: TransferFile[][] = [
    files.slice(0, -1),
    [...files, files[1]],
    files.map((f, i) => (i === 1 ? { ...f, text: f.text + "x" } : f)),
  ];
  const badOrder = structuredClone(files),
    manifest = JSON.parse(badOrder[0].text);
  manifest.volumes.reverse();
  badOrder[0].text = JSON.stringify(manifest);
  invalid.push(badOrder);
  const other = await exportVolumes(db);
  invalid.push([files[0], ...other.slice(1)]);
  for (const input of invalid) {
    await expect(restoreVolumes(input, db)).rejects.toThrow();
    expect(await snapshot()).toEqual(expected);
  }
});
it("R3 migration: late write interruption rolls back the complete 501-card transaction", async () => {
  await legacy();
  const files = await exportVolumes(db),
    expected = await snapshot();
  const hook = () => {
    throw Error("interrupted final migration write");
  };
  db.settings.hook("creating", hook);
  await expect(restoreVolumes(files, db)).rejects.toThrow("interrupted");
  db.settings.hook("creating").unsubscribe(hook);
  expect(await snapshot()).toEqual(expected);
});
it("R3 settings: separate concurrent writers cannot resurrect an older font intent or overwrite card selection", async () => {
  const local = storage(),
    first = new FontWriter(local, db),
    second = new FontWriter(local, db),
    id = crypto.randomUUID();
  await Promise.all([
    first.choose("large"),
    second.choose("normal"),
    patchSettings({ lastCardId: id }, db),
  ]);
  expect(await db.settings.get("main")).toEqual({
    ...defaults,
    lastCardId: id,
  });
  expect(pendingFont(local)).toBeNull();
});
it("R3 migration: recomputed checksums cannot hide cross-volume duplicate identities", async () => {
  await legacy();
  const expected = await snapshot(),
    files = await exportVolumes(db),
    manifest = JSON.parse(files[0].text),
    part1 = JSON.parse(files[1].text),
    part2 = JSON.parse(files[2].text);
  manifest.settings.lastCardId = null;
  part1.payload.settings.lastCardId = null;
  part2.payload.settings.lastCardId = null;
  part2.payload.cards = [part1.payload.cards[0]];
  part2.payload.reading = [part1.payload.reading[0]];
  for (const [i, part] of [part1, part2].entries()) {
    part.checksum = await hash(part.payload);
    files[i + 1].text = JSON.stringify(part);
    manifest.volumes[i].checksum = await hash(files[i + 1].text);
  }
  files[0].text = JSON.stringify(manifest);
  await expect(restoreVolumes(files, db)).rejects.toThrow(/重复/);
  expect(await snapshot()).toEqual(expected);
});
