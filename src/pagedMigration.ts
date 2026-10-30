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
import { hash, parseJSON, MAX_BACKUP_VALUES } from "./model";
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
  };
  await work.jobs.add(job);
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
export async function commitPagedRestore(
  jobId: string,
  target: MindDB = db,
  work = migrationWorkspace,
  options: {
    signal?: AbortSignal;
    onProgress?: (p: MigrationProgress) => void;
  } = {},
) {
  const job = await work.jobs.get(jobId);
  if (job?.kind !== "restore" || job.state !== "ready" || !job.root)
    throw Error("所有分卷验证完成前禁止替换原库");
  let count = 0,
    maxBatch = 0,
    last = "";
  await target.transaction(
    "rw",
    target.cards,
    target.reading,
    target.settings,
    async () => {
      await target.cards.clear();
      await target.reading.clear();
      await target.settings.clear();
      while (true) {
        cancelled(options.signal);
        const batch = await external(() =>
          work.cards
            .where("[job+id]")
            .between([jobId, last], [jobId, Dexie.maxKey], false, true)
            .limit(MIGRATION_BATCH)
            .toArray(),
        );
        if (!batch.length) break;
        maxBatch = Math.max(maxBatch, batch.length);
        const reading = await external(() =>
          work.reading.bulkGet(
            batch.map((c) => [jobId, c.id] as [string, string]),
          ),
        );
        if (reading.some((r) => !r)) throw Error("暂存阅读数据缺失");
        await external(async () => {
          if (
            batch.some(
              (c) => c.id !== c.record.id || c.hash !== c.record.hash,
            ) ||
            reading.some((r) => r!.cardId !== r!.record.cardId)
          )
            throw Error("暂存标识已改变，全部写入回滚");
          const part: Payload = {
            cards: batch.map((c) => c.record),
            reading: reading.map((r) => r!.record),
            settings: {
              ...job.root!.settings,
              lastCardId:
                job.root!.settings.lastCardId &&
                batch.some((c) => c.id === job.root!.settings.lastCardId)
                  ? job.root!.settings.lastCardId
                  : null,
            },
          };
          await validatePayload(
            backupSchema.parse({
              version: 1,
              checksum: "0".repeat(64),
              payload: part,
            }).payload,
          );
        });
        await target.cards.bulkAdd(batch.map((c) => c.record));
        await target.reading.bulkAdd(reading.map((r) => r!.record));
        count += batch.length;
        last = batch.at(-1)!.id;
        options.onProgress?.({ ...job, cards: count, maxBatchCards: maxBatch });
      }
      cancelled(options.signal);
      if (count !== job.root!.totalCards)
        throw Error("暂存数量变化；全部写入回滚");
      if (
        job.root!.settings.lastCardId &&
        !(await target.cards.get(job.root!.settings.lastCardId))
      )
        throw Error("恢复后的全局阅读引用缺失，全部写入回滚");
      await target.settings.put(job.root!.settings);
    },
  );
  // A crash here may leave a ready staging job, but never a partially replaced library. No automatic promotion on startup.
  await work.jobs
    .update(jobId, { state: "complete", maxBatchCards: maxBatch })
    .catch(() => undefined);
  return { ...job, state: "complete" as const, maxBatchCards: maxBatch };
}
