import Dexie, { type Table } from "dexie";
import { z } from "zod";
import {
  db,
  defaults,
  backupSchema,
  settingsSchema,
  validatePayload,
  type MindDB,
  type Payload,
  type StoredCard,
  type Reading,
} from "./db";
import { canonical, hash, parseJSON, MAX_BACKUP_VALUES } from "./model";
import { VOLUME_BYTES, type TransferFile } from "./volumes";
export const MIGRATION_BATCH = 4;
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const rootBody = z
  .object({
    kind: z.literal("mindflow-paged-transfer"),
    version: z.literal(1),
    setId: z.uuid(),
    settings: settingsSchema,
    totalCards: z.number().int().nonnegative().safe(),
    totalParts: z.number().int().positive().safe(),
    totalBytes: z.number().int().nonnegative().safe(),
    chain: hex,
  })
  .strict();
const rootSchema = rootBody.extend({ checksum: hex }).strict();
export type MigrationRoot = z.infer<typeof rootSchema>;
export interface MigrationProgress {
  cards: number;
  parts: number;
  bytes: number;
  maxPartBytes: number;
  maxBatchCards: number;
}
export interface MigrationJob extends MigrationProgress {
  id: string;
  kind: "export" | "restore";
  createdAt: number;
  state: "working" | "ready" | "complete" | "failed";
  setId: string;
  root?: MigrationRoot;
  chain: string;
  error?: string;
  direct?: boolean;
  integrityVersion?: 1;
}
interface StageCard {
  job: string;
  id: string;
  hash: string;
  record: StoredCard;
}
interface StageReading {
  job: string;
  cardId: string;
  record: Reading;
}
interface Receipt {
  job: string;
  index: number;
  name: string;
  checksum: string;
  cards: number;
  bytes: number;
}
export class MigrationWorkspace extends Dexie {
  jobs!: Table<MigrationJob, string>;
  cards!: Table<StageCard, [string, string]>;
  reading!: Table<StageReading, [string, string]>;
  files!: Table<{ job: string; index: number; text: string }, [string, number]>;
  receipts!: Table<Receipt, [string, number]>;
  constructor(name = "mindflow-migration-workspace-v1") {
    super(name);
    this.version(1).stores({
      jobs: "id,createdAt,kind",
      cards: "[job+id],job,&[job+hash]",
      reading: "[job+cardId],job",
      files: "[job+index],job",
      receipts: "[job+index],job",
    });
  }
}
export const migrationWorkspace = new MigrationWorkspace();
const bytes = (text: string) => new TextEncoder().encode(text).length;
const filename = (setId: string, index: number) =>
  `mindflow-${setId}-stream-${String(index).padStart(8, "0")}.json`;
export const manifestName = (setId: string) =>
  `mindflow-${setId}-stream-manifest.json`;
const external = <T>(fn: () => Promise<T>) =>
  Dexie.waitFor(Dexie.ignoreTransaction(fn), 60000);
const initialChain = (setId: string, settings: Payload["settings"]) =>
  hash({ kind: "mindflow-paged-transfer", setId, settings });
const nextChain = (previous: string, entry: Omit<Receipt, "job">) =>
  hash({ previous, ...entry });
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw Error("迁移已取消；原数据库未修改");
}
export async function listMigrationJobs(work = migrationWorkspace) {
  return work.jobs.orderBy("createdAt").reverse().limit(20).toArray();
}
export async function discardMigration(job: string, work = migrationWorkspace) {
  await work.transaction("rw", work.tables, async () => {
    for (const table of [work.cards, work.reading, work.files, work.receipts])
      await table.where("job").equals(job).delete();
    await work.jobs.delete(job);
  });
}
// One readonly snapshot; only a bounded batch/part is ever in JavaScript. Sink may write a local folder.
export async function exportPagedMigration(
  target: MindDB = db,
  work = migrationWorkspace,
  options: {
    sink?: (file: TransferFile) => Promise<void>;
    signal?: AbortSignal;
    onProgress?: (p: MigrationProgress) => void;
  } = {},
) {
  const setId = crypto.randomUUID(),
    id = "export-" + setId;
  let job: MigrationJob = {
    id,
    setId,
    kind: "export",
    createdAt: Date.now(),
    state: "working",
    cards: 0,
    parts: 0,
    bytes: 0,
    maxPartBytes: 0,
    maxBatchCards: 0,
    chain: "",
    direct: !!options.sink,
  };
  if (!options.sink) await work.jobs.add(job);
  try {
    const root = await target.transaction(
      "r",
      target.cards,
      target.reading,
      target.settings,
      async () => {
        const settings = (await target.settings.get("main")) ?? defaults;
        settingsSchema.parse(settings);
        if (
          settings.lastCardId &&
          !(await target.cards.get(settings.lastCardId))
        )
          throw Error("原库最后阅读引用不完整，未改动原数据");
        const count = await target.cards.count();
        if ((await target.reading.count()) !== count)
          throw Error("原库阅读记录数量不完整，未改动原数据");
        job.chain = await external(() => initialChain(setId, settings));
        let last = "",
          part: StoredCard[] = [],
          partSize = 1024;
        const flush = async () => {
          cancelled(options.signal);
          const reading: Reading[] = [];
          for (const card of part) {
            const state = await target.reading.get(card.id);
            if (!state) throw Error("原库缺少阅读状态");
            reading.push(state);
          }
          const payload: Payload = {
            cards: part,
            reading,
            settings: {
              ...settings,
              lastCardId:
                settings.lastCardId &&
                part.some((c) => c.id === settings.lastCardId)
                  ? settings.lastCardId
                  : null,
            },
          };
          await external(async () => {
            const envelope = backupSchema.parse({
              version: 1,
              checksum: await hash(payload),
              payload,
            });
            await validatePayload(envelope.payload);
            const text = JSON.stringify(envelope),
              size = bytes(text);
            if (size > VOLUME_BYTES) throw Error("单卷超过 8 MiB，未截断卡片");
            const index = job.parts + 1,
              name = filename(setId, index),
              entry = {
                index,
                name,
                checksum: await hash(text),
                cards: part.length,
                bytes: size,
              };
            const chain = await nextChain(job.chain, entry);
            const next = {
              ...job,
              chain,
              cards: job.cards + part.length,
              parts: index,
              bytes: job.bytes + size,
              maxPartBytes: Math.max(job.maxPartBytes, size),
            };
            if (options.sink) await options.sink({ name, text });
            else
              await work.transaction(
                "rw",
                work.files,
                work.receipts,
                work.jobs,
                async () => {
                  await work.files.add({ job: id, index, text });
                  await work.receipts.add({ job: id, ...entry });
                  await work.jobs.put(next);
                },
              );
            job = next;
            options.onProgress?.(job);
          });
          part = [];
          partSize = 1024;
        };
        while (true) {
          cancelled(options.signal);
          const batch = await target.cards
            .where("id")
            .above(last)
            .limit(MIGRATION_BATCH)
            .toArray();
          if (!batch.length) break;
          job.maxBatchCards = Math.max(job.maxBatchCards, batch.length);
          for (const card of batch) {
            const cost = bytes(JSON.stringify(card)) + 512;
            if (
              part.length &&
              (part.length >= 500 || partSize + cost > VOLUME_BYTES)
            )
              await flush();
            part.push(card);
            partSize += cost;
            last = card.id;
          }
        }
        if (part.length || !job.parts) await flush();
        if (job.cards !== count) throw Error("快照数量不一致");
        const body = rootBody.parse({
          kind: "mindflow-paged-transfer",
          version: 1,
          setId,
          settings,
          totalCards: job.cards,
          totalParts: job.parts,
          totalBytes: job.bytes,
          chain: job.chain,
        });
        return { ...body, checksum: await external(() => hash(body)) };
      },
    );
    cancelled(options.signal);
    // Completion manifest is published only after the entire readonly source snapshot succeeds.
    if (options.sink)
      await options.sink({
        name: manifestName(setId),
        text: JSON.stringify(root),
      });
    job = { ...job, state: "ready", root };
    if (!options.sink) await work.jobs.put(job);
    return job;
  } catch (e) {
    if (!options.sink)
      await work.jobs
        .update(id, {
          state: "failed",
          error: e instanceof Error ? e.message : "迁出失败",
        })
        .catch(() => undefined);
    throw e;
  }
}
export async function readExportFile(
  jobId: string,
  index: number,
  work = migrationWorkspace,
): Promise<TransferFile> {
  const job = await work.jobs.get(jobId);
  if (job?.state !== "ready" || !job.root)
    throw Error("导出未完成，没有完整清单");
  if (index === 0)
    return { name: manifestName(job.setId), text: JSON.stringify(job.root) };
  const file = await work.files.get([jobId, index]);
  if (!file) throw Error("暂存卷缺失，原库未删除，可重新导出");
  return { name: filename(job.setId, index), text: file.text };
}
export async function beginPagedRestore(
  file: TransferFile,
  work = migrationWorkspace,
) {
  const root = rootSchema.parse(parseJSON(file.text, 16 * 1024));
  const { checksum, ...body } = root;
  if (
    file.name !== manifestName(root.setId) ||
    (await hash(body)) !== checksum ||
    root.totalParts > Math.max(1, root.totalCards) ||
    root.totalParts < Math.max(1, Math.ceil(root.totalCards / 500))
  )
    throw Error("迁移清单校验或分卷数量错误");
  const id = "restore-" + root.setId,
    old = await work.jobs.get(id);
  if (old) {
    if (old.root?.checksum !== root.checksum)
      throw Error("同一迁移标识的清单发生变化");
    if (old.integrityVersion !== 1)
      throw Error(
        "旧版恢复暂存缺少原始卷证明；请只删除该暂存，再重新选择原清单和分卷。原库未改动",
      );
    return old;
  }
  const job: MigrationJob = {
    id,
    kind: "restore",
    createdAt: Date.now(),
    state: "working",
    setId: root.setId,
    root,
    cards: 0,
    parts: 0,
    bytes: 0,
    maxPartBytes: 0,
    maxBatchCards: 0,
    chain: await initialChain(root.setId, root.settings),
    integrityVersion: 1,
  };
  await work.transaction("rw", work.jobs, work.files, async () => {
    await work.jobs.add(job);
    await work.files.add({ job: id, index: 0, text: file.text });
  });
  return job;
}
export async function stagePagedPart(
  jobId: string,
  file: TransferFile,
  work = migrationWorkspace,
) {
  const job = await work.jobs.get(jobId);
  if (!job?.root || job.kind !== "restore" || job.state === "complete")
    throw Error("请先选择恢复清单");
  if (job.integrityVersion !== 1)
    throw Error("旧版恢复暂存缺少原始卷证明；请重新暂存原备份，原库未改动");
  const root = job.root;
  const prefix = `mindflow-${job.setId}-stream-`,
    suffix = file.name.startsWith(prefix) ? file.name.slice(prefix.length) : "";
  if (!/^\d+\.json$/.test(suffix)) throw Error("分卷不属于当前清单");
  const index = Number(suffix.slice(0, -5));
  if (
    !Number.isSafeInteger(index) ||
    index < 1 ||
    index > root.totalParts ||
    file.name !== filename(root.setId, index) ||
    bytes(file.text) > VOLUME_BYTES
  )
    throw Error("分卷编号或大小错误");
  const checksum = await hash(file.text),
    old = await work.receipts.get([jobId, index]);
  if (old) {
    if (old.checksum !== checksum) throw Error("重复卷内容不同");
    return job;
  }
  if (index !== job.parts + 1)
    throw Error(`缺少第 ${job.parts + 1} 卷；已暂存的部分尚未替换原库`);
  const envelope = backupSchema.parse(
    parseJSON(file.text, VOLUME_BYTES, MAX_BACKUP_VALUES, 68),
  );
  if ((await hash(envelope.payload)) !== envelope.checksum)
    throw Error("分卷校验和错误");
  await validatePayload(envelope.payload);
  const { payload } = envelope;
  const expectedLast =
    root.settings.lastCardId &&
    payload.cards.some((c) => c.id === root.settings.lastCardId)
      ? root.settings.lastCardId
      : null;
  if (
    payload.settings.fontSize !== root.settings.fontSize ||
    payload.settings.lastCardId !== expectedLast ||
    (!payload.cards.length && root.totalCards !== 0)
  )
    throw Error("分卷设置或内容不匹配");
  const entry = {
      index,
      name: file.name,
      checksum,
      cards: payload.cards.length,
      bytes: bytes(file.text),
    },
    chain = await nextChain(job.chain, entry);
  const next: MigrationJob = {
    ...job,
    chain,
    cards: job.cards + entry.cards,
    parts: index,
    bytes: job.bytes + entry.bytes,
    maxPartBytes: Math.max(job.maxPartBytes, entry.bytes),
  };
  await work.transaction(
    "rw",
    work.cards,
    work.reading,
    work.receipts,
    work.jobs,
    work.files,
    async () => {
      const current = await work.jobs.get(jobId);
      if (current?.parts !== job.parts)
        throw Error("暂存进度已变化，请重新选择此卷");
      await work.cards.bulkAdd(
        payload.cards.map((record) => ({
          job: jobId,
          id: record.id,
          hash: record.hash,
          record,
        })),
      );
      await work.reading.bulkAdd(
        payload.reading.map((record) => ({
          job: jobId,
          cardId: record.cardId,
          record,
        })),
      );
      await work.receipts.add({ job: jobId, ...entry });
      // Preserve the exact bytes bound by the external manifest's chain. Derived rows alone are not proof.
      await work.files.add({ job: jobId, index, text: file.text });
      if (index === root.totalParts) {
        if (
          next.cards !== root.totalCards ||
          next.bytes !== root.totalBytes ||
          chain !== root.chain ||
          (await work.cards.where("job").equals(jobId).count()) !==
            next.cards ||
          (await work.reading.where("job").equals(jobId).count()) !== next.cards
        )
          throw Error("整套分卷链、总数或总字节数不完整");
        if (
          root.settings.lastCardId &&
          !(await work.cards.get([jobId, root.settings.lastCardId]))
        )
          throw Error("全局阅读引用缺失");
        next.state = "ready";
      }
      await work.jobs.put(next);
    },
  );
  return next;
}
// All authority comes from original file texts bound by the root chain, never from a ready flag.
// A verified batch is a private value snapshot; the destination writes those exact values,
// without re-reading mutable staging rows between verification and use.
export async function commitPagedRestore(
  jobId: string,
  target: MindDB = db,
  work = migrationWorkspace,
  options: {
    signal?: AbortSignal;
    onProgress?: (p: MigrationProgress) => void;
  } = {},
) {
  const mismatch = () =>
    Error(
      "暂存完整性校验失败：数据与原始清单/分卷不一致；全部写入回滚，请重新暂存原备份",
    );
  const job = await work.jobs.get(jobId);
  if (job?.kind !== "restore" || job.state !== "ready" || !job.root)
    throw Error("所有分卷验证完成前禁止替换原库");
  if (job.integrityVersion !== 1)
    throw Error("旧版恢复暂存缺少原始卷证明；请重新暂存原备份，原库未改动");
  const root = rootSchema.parse(job.root);
  const checkRoot = async () => {
    const proof = await work.files.get([jobId, 0]);
    if (!proof) throw mismatch();
    const original = rootSchema.parse(parseJSON(proof.text, 16 * 1024));
    const { checksum, ...body } = original;
    if (
      canonical(original) !== canonical(root) ||
      (await external(() => hash(body))) !== checksum ||
      jobId !== "restore-" + root.setId ||
      job.setId !== root.setId
    )
      throw mismatch();
    const current = await work.jobs.get(jobId);
    if (
      current?.integrityVersion !== 1 ||
      canonical(current.root) !== canonical(root)
    )
      throw mismatch();
    if (
      (await work.cards.where("job").equals(jobId).count()) !==
        root.totalCards ||
      (await work.reading.where("job").equals(jobId).count()) !==
        root.totalCards ||
      (await work.files.where("job").equals(jobId).count()) !==
        root.totalParts + 1 ||
      (await work.receipts.where("job").equals(jobId).count()) !==
        root.totalParts
    )
      throw mismatch();
  };
  // Cheap preflight before opening a destructive transaction; every proof is rechecked inside it.
  await checkRoot();
  let count = 0,
    totalBytes = 0,
    maxBatch = 0;
  let chain = await initialChain(root.setId, root.settings);
  await target.transaction(
    "rw",
    target.cards,
    target.reading,
    target.settings,
    async () => {
      await target.cards.clear();
      await target.reading.clear();
      await target.settings.clear();
      for (let index = 1; index <= root.totalParts; index++) {
        cancelled(options.signal);
        const { payload, entry } = await external(async () => {
          const [file, receipt] = await work.transaction(
            "r",
            work.files,
            work.receipts,
            () =>
              Promise.all([
                work.files.get([jobId, index]),
                work.receipts.get([jobId, index]),
              ]),
          );
          if (!file || !receipt || bytes(file.text) > VOLUME_BYTES)
            throw mismatch();
          const envelope = backupSchema.parse(
            parseJSON(file.text, VOLUME_BYTES, MAX_BACKUP_VALUES, 68),
          );
          if ((await hash(envelope.payload)) !== envelope.checksum)
            throw mismatch();
          await validatePayload(envelope.payload);
          const { payload } = envelope;
          const entry = {
            index,
            name: filename(root.setId, index),
            checksum: await hash(file.text),
            cards: payload.cards.length,
            bytes: bytes(file.text),
          };
          if (canonical(receipt) !== canonical({ job: jobId, ...entry }))
            throw mismatch();
          const expectedLast =
            root.settings.lastCardId &&
            payload.cards.some((c) => c.id === root.settings.lastCardId)
              ? root.settings.lastCardId
              : null;
          if (
            payload.settings.fontSize !== root.settings.fontSize ||
            payload.settings.lastCardId !== expectedLast ||
            (!payload.cards.length && root.totalCards !== 0)
          )
            throw mismatch();
          chain = await nextChain(chain, entry);
          return { payload, entry };
        });
        // The original part is an invocation-private value snapshot, never exposed through callbacks.
        const states = new Map(payload.reading.map((r) => [r.cardId, r]));
        for (
          let offset = 0;
          offset < payload.cards.length;
          offset += MIGRATION_BATCH
        ) {
          cancelled(options.signal);
          const cards = payload.cards.slice(offset, offset + MIGRATION_BATCH);
          const reading = cards.map((c) => states.get(c.id)!);
          await external(async () => {
            const [stagedCards, stagedReading] = await work.transaction(
              "r",
              work.cards,
              work.reading,
              () =>
                Promise.all([
                  work.cards.bulkGet(
                    cards.map((c) => [jobId, c.id] as [string, string]),
                  ),
                  work.reading.bulkGet(
                    cards.map((c) => [jobId, c.id] as [string, string]),
                  ),
                ]),
            );
            for (let i = 0; i < cards.length; i++) {
              if (
                canonical(stagedCards[i]) !==
                  canonical({
                    job: jobId,
                    id: cards[i].id,
                    hash: cards[i].hash,
                    record: cards[i],
                  }) ||
                canonical(stagedReading[i]) !==
                  canonical({
                    job: jobId,
                    cardId: cards[i].id,
                    record: reading[i],
                  })
              )
                throw mismatch();
            }
          });
          // No re-query of staging here. A writer after the comparison cannot change these values.
          await target.cards.bulkAdd(cards);
          await target.reading.bulkAdd(reading);
          if (
            canonical(await target.cards.bulkGet(cards.map((c) => c.id))) !==
              canonical(cards) ||
            canonical(await target.reading.bulkGet(cards.map((c) => c.id))) !==
              canonical(reading)
          )
            throw mismatch();
          count += cards.length;
          maxBatch = Math.max(maxBatch, cards.length);
          options.onProgress?.({
            ...job,
            cards: count,
            maxBatchCards: maxBatch,
          });
        }
        totalBytes += entry.bytes;
      }
      cancelled(options.signal);
      if (
        count !== root.totalCards ||
        totalBytes !== root.totalBytes ||
        chain !== root.chain
      )
        throw mismatch();
      await external(checkRoot);
      if (
        root.settings.lastCardId &&
        !(await target.cards.get(root.settings.lastCardId))
      )
        throw mismatch();
      await target.settings.put(root.settings);
      if (
        (await target.cards.count()) !== root.totalCards ||
        (await target.reading.count()) !== root.totalCards ||
        canonical(await target.settings.get("main")) !==
          canonical(root.settings)
      )
        throw mismatch();
    },
  );
  // Resolves only after native transaction complete; never after request success alone.
  // A crash before the workspace mark leaves a ready job but an entirely old or new destination.
  await work.jobs
    .update(jobId, { state: "complete", maxBatchCards: maxBatch })
    .catch(() => undefined);
  return { ...job, state: "complete" as const, maxBatchCards: maxBatch };
}
