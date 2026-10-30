import "fake-indexeddb/auto";
import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import example from "../contracts/mindflow-card-example-v1.json";
import { MindDB, defaults, newReading, type StoredCard } from "../src/db";
import { hash, validateCard } from "../src/model";
import {
  MigrationWorkspace,
  exportPagedMigration,
  beginPagedRestore,
  stagePagedPart,
  commitPagedRestore,
  readExportFile,
  manifestName,
  MIGRATION_BATCH,
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
async function seed(count: number, wide = false) {
  for (let i = 0; i < count; i++) {
    const content = validateCard({
      ...example,
      title: "R4 " + i,
      branches: [
        {
          id: "r",
          title: "根",
          summary: "摘要",
          content: "正文",
          children: wide
            ? Array.from({ length: 64 }, (_, j) => ({
                id: "n" + j,
                title: "节点",
                summary: "摘要",
                content: "x".repeat(19000),
                children: [],
              }))
            : [
                {
                  id: "n0",
                  title: "子",
                  summary: "摘要",
                  content: "正文",
                  children: [],
                },
              ],
        },
      ],
    });
    const c: StoredCard = {
      id: crypto.randomUUID(),
      hash: await hash(content),
      createdAt: 1,
      updatedAt: 2,
      content,
    };
    await source.transaction(
      "rw",
      source.cards,
      source.reading,
      source.settings,
      async () => {
        await source.cards.add(c);
        await source.reading.add({
          ...newReading(c.id),
          favorite: true,
          section: "tree",
          nodeId: "n0",
        });
        await source.settings.put({
          ...defaults,
          lastCardId: c.id,
          fontSize: "large",
        });
      },
    );
  }
}
async function snapshot(db: MindDB) {
  return {
    cards: await db.cards.toArray(),
    reading: await db.reading.toArray(),
    settings: await db.settings.toArray(),
  };
}
async function stageAll(jobId: string) {
  const exported = await work.jobs.get(jobId);
  const job = await beginPagedRestore(
    await readExportFile(jobId, 0, work),
    work,
  );
  for (let n = 1; n <= exported!.parts; n++)
    await stagePagedPart(job.id, await readExportFile(jobId, n, work), work);
  return job.id;
}
it("R4 count matrix: 501, 2000 and 2001 cards export and restore without a whole-library cap", async () => {
  for (const count of [501, 2000, 2001]) {
    await source.cards.clear();
    await source.reading.clear();
    await source.settings.clear();
    await seed(count);
    const before = await snapshot(source);
    const exported = await exportPagedMigration(source, work);
    expect(exported.cards).toBe(count);
    expect(exported.maxBatchCards).toBeLessThanOrEqual(MIGRATION_BATCH);
    const id = await stageAll(exported.id);
    await commitPagedRestore(id, target, work);
    expect(await snapshot(target)).toEqual(before);
    expect(await snapshot(source)).toEqual(before);
  }
}, 60000);
it("R4 byte matrix: near and beyond 40MiB, large legal cards, complete disk-sink files and exact restore", async () => {
  await seed(34, true);
  const near = await exportPagedMigration(source, work);
  expect(near.bytes).toBeGreaterThan(39 * 1024 * 1024);
  expect(near.bytes).toBeLessThan(40 * 1024 * 1024);
  const original = (await source.cards.toArray())[0];
  const content = validateCard({ ...original.content, title: "over40" }),
    id = crypto.randomUUID();
  await source.cards.add({
    ...original,
    id,
    hash: await hash(content),
    content,
  });
  await source.reading.add({
    ...newReading(id),
    section: "tree",
    nodeId: "n0",
  });
  const dir = await mkdtemp(join(tmpdir(), "mindflow-r4-"));
  try {
    const exported = await exportPagedMigration(source, work, {
      sink: async (f) => {
        await writeFile(join(dir, f.name), f.text);
      },
    });
    expect(exported.bytes).toBeGreaterThan(40 * 1024 * 1024);
    expect(exported.maxPartBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(await work.files.where("job").equals(exported.id).count()).toBe(0);
    const root = await beginPagedRestore(
      {
        name: manifestName(exported.setId),
        text: await readFile(join(dir, manifestName(exported.setId)), "utf8"),
      },
      work,
    );
    for (let n = 1; n <= exported.parts; n++) {
      const name = `mindflow-${exported.setId}-stream-${String(n).padStart(8, "0")}.json`;
      await stagePagedPart(
        root.id,
        { name, text: await readFile(join(dir, name), "utf8") },
        work,
      );
    }
    await commitPagedRestore(root.id, target, work);
    expect(await snapshot(target)).toEqual(await snapshot(source));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);
it("R4 restore resumes after reopening workspace; missing, mixed, corrupt and conflicting duplicate parts never touch target", async () => {
  await seed(501);
  const expected = await snapshot(target),
    exported = await exportPagedMigration(source, work),
    job = await beginPagedRestore(
      await readExportFile(exported.id, 0, work),
      work,
    ),
    one = await readExportFile(exported.id, 1, work),
    two = await readExportFile(exported.id, 2, work);
  await expect(stagePagedPart(job.id, two, work)).rejects.toThrow(/缺少/);
  await expect(commitPagedRestore(job.id, target, work)).rejects.toThrow();
  await stagePagedPart(job.id, one, work);
  await stagePagedPart(job.id, one, work);
  await expect(
    stagePagedPart(job.id, { ...one, text: one.text + " " }, work),
  ).rejects.toThrow(/重复/);
  await expect(
    stagePagedPart(job.id, { ...two, text: two.text.slice(0, -1) }, work),
  ).rejects.toThrow();
  await expect(
    stagePagedPart(
      job.id,
      { ...two, name: two.name.replace(exported.setId, crypto.randomUUID()) },
      work,
    ),
  ).rejects.toThrow();
  expect(await snapshot(target)).toEqual(expected);
  const name = work.name;
  work.close();
  work = new MigrationWorkspace(name);
  await beginPagedRestore(await readExportFile(exported.id, 0, work), work);
  await stagePagedPart(job.id, two, work);
  await commitPagedRestore(job.id, target, work);
  expect(await snapshot(target)).toEqual(await snapshot(source));
});
it("R4 quota and abort at staging/promotion retain original and validated staging for retry", async () => {
  await seed(40);
  const exported = await exportPagedMigration(source, work),
    job = await beginPagedRestore(
      await readExportFile(exported.id, 0, work),
      work,
    ),
    file = await readExportFile(exported.id, 1, work);
  const quota = () => {
    throw new DOMException("synthetic quota", "QuotaExceededError");
  };
  work.cards.hook("creating", quota);
  await expect(stagePagedPart(job.id, file, work)).rejects.toThrow();
  work.cards.hook("creating").unsubscribe(quota);
  expect(await work.cards.where("job").equals(job.id).count()).toBe(0);
  await stagePagedPart(job.id, file, work);
  const before = await snapshot(target);
  target.settings.hook("creating", quota);
  await expect(commitPagedRestore(job.id, target, work)).rejects.toThrow();
  target.settings.hook("creating").unsubscribe(quota);
  expect(await snapshot(target)).toEqual(before);
  expect((await work.jobs.get(job.id))?.state).toBe("ready");
  const controller = new AbortController();
  await expect(
    commitPagedRestore(job.id, target, work, {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }),
  ).rejects.toThrow(/取消/);
  expect(await snapshot(target)).toEqual(before);
  await commitPagedRestore(job.id, target, work);
  expect(await snapshot(target)).toEqual(await snapshot(source));
});
it("R4 incomplete export never publishes completion manifest and never deletes source; disk mode bypasses workspace quota", async () => {
  await seed(501);
  const before = await snapshot(source),
    controller = new AbortController();
  await expect(
    exportPagedMigration(source, work, {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }),
  ).rejects.toThrow(/取消/);
  expect(await snapshot(source)).toEqual(before);
  const failed = (await work.jobs.toArray())[0];
  await expect(readExportFile(failed.id, 0, work)).rejects.toThrow(/未完成/);
  const quota = () => {
    throw new DOMException("workspace full", "QuotaExceededError");
  };
  work.jobs.hook("creating", quota);
  await expect(exportPagedMigration(source, work)).rejects.toThrow();
  let files = 0;
  const direct = await exportPagedMigration(source, work, {
    sink: async () => {
      files++;
    },
  });
  expect(files).toBe(direct.parts + 1);
  expect(await snapshot(source)).toEqual(before);
  work.jobs.hook("creating").unsubscribe(quota);
});
it("R4 stage corruption and illegal oversized single cards reject without truncation or destination mutation", async () => {
  await seed(2);
  const exported = await exportPagedMigration(source, work),
    job = await stageAll(exported.id),
    record = (await work.cards.where("job").equals(job).first())!;
  record.record.content.title = "changed";
  await work.cards.put(record);
  await expect(commitPagedRestore(job, target, work)).rejects.toThrow(/校验/);
  expect(await target.cards.count()).toBe(0);
  const c = (await source.cards.toArray())[0];
  c.content.branches[0].content = "x".repeat(2 * 1024 * 1024 + 1);
  await source.cards.put(c);
  await expect(exportPagedMigration(source, work)).rejects.toThrow();
  expect(await source.cards.count()).toBe(2);
});
