import { z } from "zod";
import {
  db,
  backupSchema,
  settingsSchema,
  validatePayload,
  replacePayload,
  defaults,
  type MindDB,
  type Payload,
} from "./db";
import { hash, parseJSON, MAX_BACKUP_BYTES, MAX_BACKUP_VALUES } from "./model";
// Migration only: bounded aggregate size remains 40 MiB, not 4 x 40 MiB.
export const MAX_MIGRATION_CARDS = 2000,
  MAX_VOLUMES = 16,
  VOLUME_BYTES = 8 * 1024 * 1024;
export interface TransferFile {
  name: string;
  text: string;
}
const manifestSchema = z
  .object({
    kind: z.literal("mindflow-transfer-set"),
    version: z.literal(1),
    setId: z.uuid(),
    settings: settingsSchema,
    totalCards: z.number().int().min(0).max(MAX_MIGRATION_CARDS),
    volumes: z
      .array(
        z
          .object({
            name: z.string(),
            checksum: z.string().regex(/^[a-f0-9]{64}$/),
            cards: z.number().int().min(0).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_VOLUMES),
  })
  .strict();
const bytes = (text: string) => new TextEncoder().encode(text).length;
export async function exportVolumes(
  target: MindDB = db,
): Promise<TransferFile[]> {
  const payload = await target.transaction(
    "r",
    target.cards,
    target.reading,
    target.settings,
    async () => ({
      cards: await target.cards.toArray(),
      reading: await target.reading.toArray(),
      settings: (await target.settings.get("main")) ?? defaults,
    }),
  );
  await validatePayload(payload, MAX_MIGRATION_CARDS);
  const groups: Payload["cards"][] = [[]];
  let size = 1024;
  for (const card of payload.cards) {
    const cost = bytes(JSON.stringify(card)) + 512;
    if (groups.at(-1)!.length >= 500 || size + cost > VOLUME_BYTES) {
      groups.push([]);
      size = 1024;
    }
    groups.at(-1)!.push(card);
    size += cost;
  }
  if (groups.length > MAX_VOLUMES)
    throw Error("迁移分卷数量超限，未丢弃任何卡片");
  const setId = crypto.randomUUID(),
    files: TransferFile[] = [],
    entries = [];
  for (const [index, cards] of groups.entries()) {
    const ids = new Set(cards.map((c) => c.id));
    const part: Payload = {
      cards,
      reading: payload.reading.filter((r) => ids.has(r.cardId)),
      settings: {
        ...payload.settings,
        lastCardId:
          payload.settings.lastCardId && ids.has(payload.settings.lastCardId)
            ? payload.settings.lastCardId
            : null,
      },
    };
    const text = JSON.stringify({
      version: 1,
      checksum: await hash(part),
      payload: part,
    });
    // Each standalone volume is still a normal v1 backup.
    backupSchema.parse(JSON.parse(text));
    const name = `mindflow-${setId}-part-${String(index + 1).padStart(3, "0")}.json`;
    files.push({ name, text });
    entries.push({ name, checksum: await hash(text), cards: cards.length });
  }
  const manifest = {
    kind: "mindflow-transfer-set",
    version: 1,
    setId,
    settings: payload.settings,
    totalCards: payload.cards.length,
    volumes: entries,
  };
  files.unshift({
    name: `mindflow-${setId}-manifest.json`,
    text: JSON.stringify(manifest),
  });
  if (files.reduce((n, f) => n + bytes(f.text), 0) > MAX_BACKUP_BYTES)
    throw Error("分卷总大小超过 40 MB，未生成不完整文件");
  return files;
}
export async function restoreVolumes(
  files: TransferFile[],
  target: MindDB = db,
) {
  if (
    files.length < 2 ||
    files.length > MAX_VOLUMES + 1 ||
    files.reduce((n, f) => n + bytes(f.text), 0) > MAX_BACKUP_BYTES
  )
    throw Error("请选择完整清单和分卷（合计最多 40 MB）");
  const byName = new Map(files.map((f) => [f.name, f]));
  if (byName.size !== files.length) throw Error("分卷文件名重复");
  const manifests = files.filter((f) => f.name.endsWith("-manifest.json"));
  if (manifests.length !== 1) throw Error("必须选择且仅选择一个迁移清单");
  const manifest = manifestSchema.parse(
    parseJSON(manifests[0].text, 128 * 1024),
  );
  if (
    manifests[0].name !== `mindflow-${manifest.setId}-manifest.json` ||
    files.length !== manifest.volumes.length + 1
  )
    throw Error("清单或分卷不完整");
  const merged: Payload = {
    cards: [],
    reading: [],
    settings: manifest.settings,
  };
  for (const [index, entry] of manifest.volumes.entries()) {
    const expected = `mindflow-${manifest.setId}-part-${String(index + 1).padStart(3, "0")}.json`;
    if (entry.name !== expected) throw Error("分卷顺序或所属清单错误");
    const file = byName.get(entry.name);
    if (!file || (await hash(file.text)) !== entry.checksum)
      throw Error("分卷缺失或完整性校验失败");
    if (bytes(file.text) > VOLUME_BYTES) throw Error("单卷超过 8 MB");
    const envelope = backupSchema.parse(
      parseJSON(file.text, VOLUME_BYTES, MAX_BACKUP_VALUES, 68),
    );
    if ((await hash(envelope.payload)) !== envelope.checksum)
      throw Error("分卷校验和错误");
    await validatePayload(envelope.payload);
    const expectedLast =
      manifest.settings.lastCardId &&
      envelope.payload.cards.some((c) => c.id === manifest.settings.lastCardId)
        ? manifest.settings.lastCardId
        : null;
    if (
      envelope.payload.settings.fontSize !== manifest.settings.fontSize ||
      envelope.payload.settings.lastCardId !== expectedLast ||
      entry.cards !== envelope.payload.cards.length
    )
      throw Error("分卷设置或数量与清单不一致");
    merged.cards.push(...envelope.payload.cards);
    merged.reading.push(...envelope.payload.reading);
  }
  if (merged.cards.length !== manifest.totalCards) throw Error("清单总数不符");
  await validatePayload(merged, MAX_MIGRATION_CARDS);
  // All files validated before touching any destination store; one transaction for the complete set.
  await replacePayload(merged, target);
}
