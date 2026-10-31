import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { backup, defaults, importCard, MindDB, restore } from "../src/db";
import { ReadingSession } from "../src/readingSession";
import { syntheticCard } from "./fixtures/ux1";
let db: MindDB, session: ReadingSession;
beforeEach(() => {
  db = new MindDB(crypto.randomUUID());
  session = new ReadingSession(db);
});
afterEach(async () => {
  session.dispose();
  vi.restoreAllMocks();
  await db.delete();
});
const snapshot = async () => ({
  cards: await db.cards.toArray(),
  reading: await db.reading.toArray(),
  settings: await db.settings.toArray(),
});
async function setup() {
  const a = await importCard(
      JSON.stringify(syntheticCard({ title: "虚构 A" })),
      db,
    ),
    b = await importCard(
      JSON.stringify(syntheticCard({ title: "虚构 B" })),
      db,
    );
  await db.reading.update(a.id, {
    section: "tree",
    nodeId: "root-1",
    scroll: 720,
  });
  await db.reading.update(b.id, { section: "faq", scroll: 890 });
  await db.settings.put({ ...defaults, lastCardId: a.id });
  return { a, b };
}
it("discovery tree/FAQ/scroll/pagehide and favorite preserve old cursor and lastCardId", async () => {
  const { a, b } = await setup();
  const before = await snapshot();
  const v = (await session.open(b.id, "discover"))!;
  session.finishRestore(v, 0);
  await session.change(
    { section: "tree", nodeId: "root-2", scroll: 0 },
    "node",
  );
  session.finishRestore(session.snapshot()!, 1200);
  session.noteScroll(1800);
  await session.flush();
  await session.favorite(b.id, true);
  const expected = structuredClone(before);
  expected.reading.find((r) => r.cardId === b.id)!.favorite = true;
  expect(await snapshot()).toEqual(expected);
  expect((await db.settings.get("main"))?.lastCardId).toBe(a.id);
  const resumed = (await session.open(b.id, "resume"))!;
  expect(resumed.cursor).toEqual({ section: "faq", nodeId: null, scroll: 890 });
});
it("pending old scroll is flushed to its owner before discovering and favorite patches survive", async () => {
  const { a, b } = await setup();
  const v = (await session.open(a.id, "resume"))!;
  session.finishRestore(v, 720);
  session.noteScroll(999);
  const favorite = session.favorite(a.id, true);
  await session.open(b.id, "discover");
  await favorite;
  expect(await db.reading.get(a.id)).toMatchObject({
    favorite: true,
    scroll: 999,
    section: "tree",
  });
  expect(await db.reading.get(b.id)).toMatchObject({
    scroll: 890,
    section: "faq",
  });
});
it("late IndexedDB get cannot replace the latest discovery or persistent selection", async () => {
  const { a, b } = await setup();
  const original = db.reading.get.bind(db.reading);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = vi.spyOn(db.reading, "get");
  spy.mockImplementationOnce((...args) =>
    Dexie.Promise.resolve(gate).then(() => original(...args)),
  );
  const late = session.open(a.id, "resume");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const current = await session.open(b.id, "discover");
  release();
  expect(await late).toBeNull();
  expect(session.snapshot()).toBe(current);
  expect((await db.settings.get("main"))?.lastCardId).toBe(a.id);
});
it("explicit adopt commits cursor and lastCard together, preserving favorite and concurrent font", async () => {
  const { b } = await setup();
  await session.open(b.id, "discover");
  await session.change({ section: "tree", nodeId: "root-1" }, "node");
  await session.favorite(b.id, true);
  await db.settings.update("main", { fontSize: "large" });
  await session.adopt(1234);
  expect(await db.reading.get(b.id)).toMatchObject({
    favorite: true,
    section: "tree",
    nodeId: "root-1",
    scroll: 1234,
  });
  expect(await db.settings.get("main")).toMatchObject({
    lastCardId: b.id,
    fontSize: "large",
  });
});
it("adopt transaction failure rolls back both stores, stays temporary and permits retry", async () => {
  const { b } = await setup();
  await session.open(b.id, "discover");
  const before = await snapshot();
  const hook = () => {
    throw Error("synthetic write failure");
  };
  db.settings.hook("updating", hook);
  await expect(session.adopt(123)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  expect(session.snapshot()?.mode).toBe("discover");
  db.settings.hook("updating").unsubscribe(hook);
  await session.adopt(123);
  expect((await db.reading.get(b.id))?.scroll).toBe(123);
});
it("saved replay never persists programmatic clamping; failed scroll save retries", async () => {
  const { a } = await setup();
  const v = (await session.open(a.id, "resume"))!;
  session.noteScroll(0);
  session.finishRestore(v, 0);
  session.noteScroll(0); // queued programmatic event after restoration acknowledgement
  await session.flush();
  expect((await db.reading.get(a.id))?.scroll).toBe(720);
  session.noteScroll(1300);
  const hook = () => {
    throw Error("synthetic lock failure");
  };
  db.reading.hook("updating", hook);
  await expect(session.flush()).rejects.toThrow();
  expect((await db.reading.get(a.id))?.scroll).toBe(720);
  db.reading.hook("updating").unsubscribe(hook);
  await session.flush();
  expect((await db.reading.get(a.id))?.scroll).toBe(1300);
});
it("restore barrier drains pending writes; restored v1 snapshot survives stale tasks and reinitialization", async () => {
  const { a, b } = await setup();
  const original = await backup(db);
  const v = (await session.open(a.id, "resume"))!;
  session.finishRestore(v, 720);
  session.noteScroll(1350);
  await session.pause();
  await restore(original, db);
  session.noteScroll(9999);
  await session.initialize(a.id);
  await session.flush();
  expect(await backup(db)).toBe(original);
  await session.open(b.id, "discover");
  expect(await backup(db)).toBe(original);
});

it("ending a reading session flushes its position and ignores the programmatic library jump", async () => {
  const { a } = await setup();
  const view = (await session.open(a.id, "resume"))!;
  session.finishRestore(view, 720);
  await session.end(1000);
  session.noteScroll(5000);
  await session.flush();
  expect((await db.reading.get(a.id))?.scroll).toBe(1000);
  const reopened = (await session.open(a.id, "resume"))!;
  expect(reopened.cursor.scroll).toBe(1000);
});
it("a user scroll after applying saved layout but before restore acknowledgement is retained", async () => {
  const { a } = await setup();
  await db.reading.update(a.id, {
    scroll: 0,
    section: "summary",
    nodeId: null,
  });
  const view = (await session.open(a.id, "resume"))!;
  // The rendered layout applied y=0; an input moves it to y=300 before the RAF ack.
  Reflect.apply(session.finishRestore, session, [view, 300, 0]);
  await session.flush();
  expect((await db.reading.get(a.id))?.scroll).toBe(300);
});
