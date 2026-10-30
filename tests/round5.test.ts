import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import example from "../contracts/mindflow-card-example-v1.json";
import { MindDB, defaults, newReading, type StoredCard } from "../src/db";
import { hash, validateCard } from "../src/model";
import {
  MigrationWorkspace,
  exportPagedMigration,
  beginPagedRestore,
  readExportFile,
  stagePagedPart,
  commitPagedRestore,
} from "../src/pagedMigration";
let source: MindDB, target: MindDB, work: MigrationWorkspace;
beforeEach(() => {
  source = new MindDB(crypto.randomUUID());
  target = new MindDB(crypto.randomUUID());
  work = new MigrationWorkspace(crypto.randomUUID());
});
afterEach(async () => {
  await source.delete();
  await target.delete();
  await work.delete();
});
const snapshot = async (db: MindDB) =>
  db.transaction("r", db.tables, async () => ({
    cards: await db.cards.toArray(),
    reading: await db.reading.toArray(),
    settings: await db.settings.toArray(),
  }));
async function prepare(count = 9) {
  for (let i = 1; i <= count; i++) {
    const id = `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const content = validateCard({
      ...example,
      title: `R5 ${i}`,
      branches: [
        {
          id: "root",
          title: "根",
          summary: "摘要",
          content: "内容",
          children: [
            {
              id: "a",
              title: "A",
              summary: "摘要",
              content: "甲",
              children: [
                {
                  id: "leaf",
                  title: "叶",
                  summary: "摘要",
                  content: "叶子",
                  children: [],
                },
              ],
            },
            {
              id: "b",
              title: "B",
              summary: "摘要",
              content: "乙",
              children: [],
            },
          ],
        },
      ],
    });
    const c: StoredCard = {
      id,
      content,
      hash: await hash(content),
      createdAt: 1,
      updatedAt: 2,
    };
    await source.cards.add(c);
    await source.reading.add({
      ...newReading(id),
      section: "tree",
      nodeId: "a",
      scroll: i,
    });
  }
  const first = (await source.cards.toArray())[0];
  await source.settings.put({
    ...defaults,
    lastCardId: first.id,
    fontSize: "large",
  });
  const sentinel = { ...first, id: crypto.randomUUID() };
  await target.cards.add(sentinel);
  await target.reading.add(newReading(sentinel.id));
  await target.settings.put({ ...defaults, lastCardId: sentinel.id });
  const exported = await exportPagedMigration(source, work);
  const manifest = await readExportFile(exported.id, 0, work);
  const job = await beginPagedRestore(manifest, work);
  for (let i = 1; i <= exported.parts; i++)
    await stagePagedPart(
      job.id,
      await readExportFile(exported.id, i, work),
      work,
    );
  return { job, exported, manifest, first };
}
async function changeContent(job: string, change: (c: StoredCard) => void) {
  const row = (await work.cards.where("job").equals(job).first())!;
  change(row.record);
  row.record.hash = await hash(row.record.content);
  row.hash = row.record.hash;
  await work.cards.put(row);
}
const faults: [string, (id: string) => Promise<unknown>][] = [
  [
    "favorite",
    async (id) => {
      const r = (await work.reading.where("job").equals(id).first())!;
      r.record.favorite = !r.record.favorite;
      await work.reading.put(r);
    },
  ],
  [
    "scroll",
    async (id) => {
      const r = (await work.reading.where("job").equals(id).first())!;
      r.record.scroll++;
      await work.reading.put(r);
    },
  ],
  [
    "section",
    async (id) => {
      const r = (await work.reading.where("job").equals(id).first())!;
      r.record.section = "faq";
      await work.reading.put(r);
    },
  ],
  [
    "reading-node-reference",
    async (id) => {
      const r = (await work.reading.where("job").equals(id).first())!;
      r.record.nodeId = "b";
      await work.reading.put(r);
    },
  ],
  [
    "createdAt",
    (id) =>
      changeContent(id, (c) => {
        c.createdAt = 0;
      }),
  ],
  [
    "updatedAt",
    (id) =>
      changeContent(id, (c) => {
        c.updatedAt = 3;
      }),
  ],
  [
    "card-content-with-valid-new-hash",
    (id) =>
      changeContent(id, (c) => {
        c.content.summary += "变更";
      }),
  ],
  [
    "node-order-with-valid-new-hash",
    (id) =>
      changeContent(id, (c) => {
        c.content.branches[0].children.reverse();
      }),
  ],
  [
    "parent-child-with-valid-new-hash",
    (id) =>
      changeContent(id, (c) => {
        const [a, b] = c.content.branches[0].children;
        b.children.push(a.children.pop()!);
      }),
  ],
  [
    "child-content-with-valid-new-hash",
    (id) =>
      changeContent(id, (c) => {
        c.content.branches[0].children[0].children[0].content += "变更";
      }),
  ],
  [
    "source-association-with-valid-new-hash",
    (id) =>
      changeContent(id, (c) => {
        c.content.source.chat_url = "https://example.test/changed";
      }),
  ],
  [
    "card-id",
    async (id) => {
      const r = (await work.cards.where("job").equals(id).first())!;
      r.record.id = crypto.randomUUID();
      await work.cards.put(r);
    },
  ],
  [
    "reading-card-association",
    async (id) => {
      const r = (await work.reading.where("job").equals(id).first())!;
      r.record.cardId = crypto.randomUUID();
      await work.reading.put(r);
    },
  ],
  ["delete-volume", (id) => work.files.delete([id, 1])],
  [
    "truncate-volume",
    async (id) => {
      const r = (await work.files.get([id, 1]))!;
      r.text = r.text.slice(0, -1);
      await work.files.put(r);
    },
  ],
  [
    "replace-valid-volume",
    async (id) => {
      const r = (await work.files.get([id, 1]))!;
      const e = JSON.parse(r.text);
      e.payload.reading[0].favorite = !e.payload.reading[0].favorite;
      e.checksum = await hash(e.payload);
      r.text = JSON.stringify(e);
      await work.files.put(r);
    },
  ],
  [
    "receipt",
    async (id) => {
      const r = (await work.receipts.get([id, 1]))!;
      r.bytes++;
      await work.receipts.put(r);
    },
  ],
  [
    "job-root-settings",
    async (id) => {
      const r = (await work.jobs.get(id))!;
      r.root!.settings.fontSize = "normal";
      await work.jobs.put(r);
    },
  ],
  [
    "original-root-proof-even-with-new-self-checksum",
    async (id) => {
      const r = (await work.files.get([id, 0]))!;
      const root = JSON.parse(r.text);
      root.settings.fontSize = "normal";
      const { checksum: _checksum, ...body } = root;
      void _checksum;
      root.checksum = await hash(body);
      r.text = JSON.stringify(root);
      await work.files.put(r);
    },
  ],
];
it.each(faults)(
  "R5 post-verification fault: %s rejects and preserves all destination/source data",
  async (_name, mutate) => {
    const { job, exported, manifest } = await prepare();
    const before = await snapshot(target),
      original = await snapshot(source);
    const originalFile = await readExportFile(exported.id, 1, work);
    await mutate(job.id);
    await expect(commitPagedRestore(job.id, target, work)).rejects.toThrow();
    expect(await snapshot(target)).toEqual(before);
    expect(await snapshot(source)).toEqual(original);
    expect((await work.jobs.get(job.id))!.state).toBe("ready");
    expect(await readExportFile(exported.id, 1, work)).toEqual(originalFile);
    expect(await readExportFile(exported.id, 0, work)).toEqual(manifest);
  },
);
it("R5 coordinated part/receipt/derived-row alteration still fails the original root chain after writes and rolls back", async () => {
  const { job } = await prepare(),
    before = await snapshot(target);
  const f = (await work.files.get([job.id, 1]))!,
    envelope = JSON.parse(f.text);
  const changed = envelope.payload.reading[0];
  changed.favorite = !changed.favorite;
  envelope.checksum = await hash(envelope.payload);
  f.text = JSON.stringify(envelope);
  const row = (await work.reading.get([job.id, changed.cardId]))!;
  row.record = changed;
  const receipt = (await work.receipts.get([job.id, 1]))!;
  receipt.checksum = await hash(f.text);
  receipt.bytes = new TextEncoder().encode(f.text).length;
  await work.files.put(f);
  await work.reading.put(row);
  await work.receipts.put(receipt);
  let writes = 0;
  target.cards.hook("creating", () => {
    writes++;
  });
  await expect(commitPagedRestore(job.id, target, work)).rejects.toThrow(
    /完整性/,
  );
  expect(writes).toBe(9);
  expect(await snapshot(target)).toEqual(before);
});
it("R5 private verified value snapshot survives a concurrent write at the final destination-add boundary; written data equals original", async () => {
  const { job, first } = await prepare();
  const peer = new MigrationWorkspace(work.name);
  await peer.open();
  let mutationCommitted = false,
    boundary = false;
  const originalAdd = target.cards.bulkAdd.bind(target.cards);
  const interceptor = vi.spyOn(target.cards, "bulkAdd");
  interceptor.mockImplementationOnce((...args) =>
    Dexie.Promise.resolve(
      Dexie.waitFor(
        Dexie.ignoreTransaction(async () => {
          // This is after the product's full comparison, before its very first actual add request.
          boundary = true;
          const row = (await peer.reading.get([job.id, first.id]))!;
          row.record.favorite = !row.record.favorite;
          await peer.reading.put(row);
          mutationCommitted = true;
        }),
      ),
    ).then(() => {
      expect(mutationCommitted).toBe(true);
      return originalAdd(...args);
    }),
  );
  await commitPagedRestore(job.id, target, work);
  interceptor.mockRestore();
  expect(boundary).toBe(true);
  expect(mutationCommitted).toBe(true);
  expect(await snapshot(target)).toEqual(await snapshot(source));
  expect((await work.reading.get([job.id, first.id]))!.record.favorite).toBe(
    true,
  );
  peer.close();
});
it("R5 late-batch mismatch rolls back preceding batches; pristine re-staging after refresh permits a real retry", async () => {
  const { job, exported } = await prepare();
  const before = await snapshot(target);
  const row = (await work.reading.where("job").equals(job.id).last())!;
  row.record.scroll++;
  await work.reading.put(row);
  let writes = 0;
  target.cards.hook("creating", () => {
    writes++;
  });
  await expect(commitPagedRestore(job.id, target, work)).rejects.toThrow(
    /完整性/,
  );
  expect(writes).toBe(8);
  expect(await snapshot(target)).toEqual(before);
  const { discardMigration } = await import("../src/pagedMigration");
  await discardMigration(job.id, work);
  const name = work.name;
  work.close();
  work = new MigrationWorkspace(name);
  const retry = await beginPagedRestore(
    await readExportFile(exported.id, 0, work),
    work,
  );
  await stagePagedPart(
    retry.id,
    await readExportFile(exported.id, 1, work),
    work,
  );
  await commitPagedRestore(retry.id, target, work);
  expect(await snapshot(target)).toEqual(await snapshot(source));
});
it("R5 pre-fix ready staging is never grandfathered as verified without original proofs", async () => {
  const { job, manifest } = await prepare(),
    before = await snapshot(target);
  await work.jobs.update(job.id, { integrityVersion: undefined });
  await work.files.where("job").equals(job.id).delete();
  await expect(beginPagedRestore(manifest, work)).rejects.toThrow(/旧版/);
  await expect(commitPagedRestore(job.id, target, work)).rejects.toThrow(
    /旧版/,
  );
  expect(await snapshot(target)).toEqual(before);
});
it("R5 original proof quota failure leaves no partial staged part and retains destination/source", async () => {
  const { exported } = await prepare();
  const original = await snapshot(source),
    before = await snapshot(target);
  const { discardMigration } = await import("../src/pagedMigration");
  await discardMigration("restore-" + exported.setId, work);
  const job = await beginPagedRestore(
    await readExportFile(exported.id, 0, work),
    work,
  );
  const quota = () => {
    throw new DOMException("R5 proof quota full", "QuotaExceededError");
  };
  work.files.hook("creating", quota);
  await expect(
    stagePagedPart(job.id, await readExportFile(exported.id, 1, work), work),
  ).rejects.toThrow(/quota/);
  work.files.hook("creating").unsubscribe(quota);
  expect(await work.cards.where("job").equals(job.id).count()).toBe(0);
  expect(await work.receipts.where("job").equals(job.id).count()).toBe(0);
  expect(await snapshot(source)).toEqual(original);
  expect(await snapshot(target)).toEqual(before);
});
