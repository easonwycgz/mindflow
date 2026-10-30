import { test, expect, type Page } from "@playwright/test";
import { readFile, copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StoredCard, Reading } from "../src/db";
import type { MigrationJob } from "../src/pagedMigration";
type Rows = {
  cards: { job: string; id: string; hash: string; record: StoredCard }[];
  reading: { job: string; cardId: string; record: Reading }[];
  files: { job: string; index: number; text: string }[];
  jobs: MigrationJob[];
};
async function open(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例" }).click();
  await expect(page.locator("article h2")).toBeAttached();
  await page.goto("/migration.html");
  await page.getByText("超大旧库分页迁移", { exact: true }).click();
}
async function snapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const r = indexedDB.open("mindflow-v1");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction(["cards", "reading", "settings"]);
          const qs = ["cards", "reading", "settings"].map((n) =>
            tx.objectStore(n).getAll(),
          );
          tx.oncomplete = () => {
            db.close();
            resolve(JSON.stringify(qs.map((q) => q.result)));
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}
async function staged(page: Page) {
  await page.getByRole("button", { name: "准备分页迁出", exact: true }).click();
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "完整导出已准备",
  );
  const files = [];
  for (const label of ["下载分页完成清单", "下载分页卷 1"]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const d = await pending;
    files.push({
      name: d.suggestedFilename(),
      mimeType: "application/json",
      buffer: await readFile((await d.path())!),
    });
  }
  await page
    .getByLabel("分页迁移清单", { exact: true })
    .setInputFiles(files[0]);
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "恢复暂存已打开",
  );
  await page
    .getByLabel("分页迁移分卷", { exact: true })
    .setInputFiles(files[1]);
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "整套验证完成",
  );
  const id = "restore-" + JSON.parse(files[0].buffer.toString()).setId;
  const rows = await page.evaluate(
    (job) =>
      new Promise<Rows>((resolve, reject) => {
        const r = indexedDB.open("mindflow-migration-workspace-v1");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction(["cards", "reading", "files", "jobs"]);
          const cards = tx.objectStore("cards").index("job").getAll(job),
            reading = tx.objectStore("reading").index("job").getAll(job),
            files = tx.objectStore("files").index("job").getAll(job),
            jobs = tx.objectStore("jobs").get(job);
          tx.oncomplete = () => {
            db.close();
            resolve({
              cards: cards.result,
              reading: reading.result,
              files: files.result,
              jobs: [jobs.result],
            });
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    id,
  );
  return { id, rows, files };
}
async function replaceRows(page: Page, rows: Rows) {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("mindflow-migration-workspace-v1");
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction(
              ["cards", "reading", "files", "jobs"],
              "readwrite",
            );
          for (const [name, data] of Object.entries(rows))
            for (const row of data) tx.objectStore(name).put(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
    rows,
  );
}
async function restore(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "验证完成后原子替换", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "取消或暂停当前迁移" }),
  ).toBeHidden();
}
test("R5 all-field native faults reject, preserve complete destination, survive refresh and allow pristine retry", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  const { id, rows, files } = await staged(page),
    before = await snapshot(page);
  const faults = [
    "favorite",
    "content",
    "order",
    "parent",
    "reference",
    "child",
    "timestamp",
    "volume-replace",
    "volume-delete",
    "volume-truncate",
    "manifest",
  ];
  for (const kind of faults) {
    const changed = structuredClone(rows),
      c = changed.cards[0].record;
    switch (kind) {
      case "favorite":
        changed.reading[0].record.favorite =
          !changed.reading[0].record.favorite;
        break;
      case "content":
        c.content.summary += "故障";
        break;
      case "order":
        c.content.branches.reverse();
        break;
      case "parent":
        c.content.branches[1].children.push(
          c.content.branches[0].children.pop()!,
        );
        break;
      case "reference":
        changed.reading[0].record.nodeId = "b2";
        break;
      case "child":
        c.content.branches[0].children[0].content += "故障";
        break;
      case "timestamp":
        c.updatedAt++;
        break;
      case "volume-replace":
        changed.files.find((f) => f.index === 1)!.text = "{}";
        break;
      case "volume-truncate":
        changed.files.find((f) => f.index === 1)!.text = changed.files
          .find((f) => f.index === 1)!
          .text.slice(0, -1);
        break;
      case "manifest":
        changed.jobs[0].root!.settings.fontSize =
          changed.jobs[0].root!.settings.fontSize === "large"
            ? "normal"
            : "large";
        break;
    }
    await replaceRows(page, changed);
    if (kind === "volume-delete")
      await page.evaluate(
        (id) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open("mindflow-migration-workspace-v1");
            r.onsuccess = () => {
              const db = r.result,
                tx = db.transaction("files", "readwrite");
              tx.objectStore("files").delete([id, 1]);
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
            };
          }),
        id,
      );
    await restore(page);
    await expect(page.getByTestId("paged-migration-state")).not.toContainText(
      "完整提交成功",
    );
    await expect(page.getByTestId("paged-migration-state")).toContainText(
      "操作未完成",
    );
    expect(await snapshot(page), kind).toBe(before);
    await replaceRows(page, rows);
  }
  await page.reload();
  await page.getByText("超大旧库分页迁移", { exact: true }).click();
  await page.getByText("继续或清理本机迁移暂存", { exact: true }).click();
  await page
    .locator(".large-migration details div")
    .filter({ hasText: "restore" })
    .getByRole("button", { name: /打开暂存/ })
    .click();
  await restore(page);
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "完整提交成功",
  );
  const expected = JSON.parse(files[1].buffer.toString()).payload,
    actual = JSON.parse(await snapshot(page));
  expect(actual).toEqual([
    expected.cards,
    expected.reading,
    [expected.settings],
  ]);
});
test("R5 final native add boundary races a competing workspace write and commits only the verified value snapshot", async ({
  page,
}) => {
  await open(page);
  const { id } = await staged(page),
    before = await snapshot(page);
  await page.evaluate((job) => {
    const original = IDBObjectStore.prototype.add;
    let started = false;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (
        !started &&
        this.transaction.db.name === "mindflow-v1" &&
        this.name === "cards"
      ) {
        started = true;
        Object.assign(window, {
          r5Boundary: true,
          r5WriterQueued: false,
          r5WriterComplete: false,
        });
        const r = indexedDB.open("mindflow-migration-workspace-v1");
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("reading", "readwrite");
          Object.assign(window, { r5WriterQueued: true });
          const q = tx
            .objectStore("reading")
            .index("job")
            .openCursor(IDBKeyRange.only(job));
          q.onsuccess = () => {
            const c = q.result!;
            const row = c.value;
            row.record.favorite = !row.record.favorite;
            c.update(row);
          };
          tx.oncomplete = () => {
            db.close();
            Object.assign(window, { r5WriterComplete: true });
          };
        };
      }
      return original.apply(this, args);
    };
  }, id);
  await restore(page);
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "完整提交成功",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!(window as unknown as { r5WriterComplete: boolean })
            .r5WriterComplete,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => (window as unknown as { r5Boundary: boolean }).r5Boundary,
    ),
  ).toBe(true);
  expect(await snapshot(page)).toBe(before);
});
test("R5 no Directory API and zero workspace quota can download every part and root; real files restore exactly", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
  });
  await open(page);
  // 2001 records and ~49MiB, native bounded seeding. This also exercises the fallback beyond both old limits.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("mindflow-v1");
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction(["cards", "reading"]);
    const base = await new Promise<{ card: StoredCard; reading: Reading }>(
      (resolve) => {
        const a = tx.objectStore("cards").getAll(),
          b = tx.objectStore("reading").getAll();
        tx.oncomplete = () =>
          resolve({ card: a.result[0], reading: b.result[0] });
      },
    );
    const canon = (v: unknown): string =>
      Array.isArray(v)
        ? "[" + v.map(canon).join(",") + "]"
        : v && typeof v === "object"
          ? "{" +
            Object.keys(v)
              .sort()
              .map(
                (k) =>
                  JSON.stringify(k) +
                  ":" +
                  canon((v as Record<string, unknown>)[k]),
              )
              .join(",") +
            "}"
          : JSON.stringify(v);
    for (let start = 1; start < 2001; start += 8) {
      const batch: StoredCard[] = [];
      for (let i = start; i < Math.min(2001, start + 8); i++) {
        const content = {
          ...base.card.content,
          title: "R5 streaming " + i,
          branches: [
            {
              id: "r",
              title: "根",
              summary: "摘要",
              content: "x".repeat(19000),
              children: [
                {
                  id: "n",
                  title: "子",
                  summary: "摘要",
                  content: "y".repeat(5000),
                  children: [],
                },
              ],
            },
          ],
        };
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(canon(content)),
            ),
          ),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        batch.push({ ...base.card, id: crypto.randomUUID(), content, hash });
      }
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["cards", "reading"], "readwrite");
        for (const c of batch) {
          tx.objectStore("cards").add(c);
          tx.objectStore("reading").add({
            ...base.reading,
            cardId: c.id,
            section: "tree",
            nodeId: "n",
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.transaction.db.name === "mindflow-migration-workspace-v1")
        throw new DOMException("R5 zero workspace quota", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  const before = await snapshot(page); // test-only comparison, not production migration allocation
  await expect(
    page.getByRole("button", { name: "直接导出到本地目录" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "逐卷下载（无需暂存空间）", exact: true })
    .click();
  const dir = await mkdtemp(join(tmpdir(), "mindflow-r5-download-"));
  const paths: string[] = [];
  let root: { totalCards: number } | undefined;
  let totalBytes = 0;
  while (true) {
    const section = page.getByRole("region", { name: "无需暂存的逐卷下载" });
    await expect(section).toBeVisible({ timeout: 60000 });
    const pending = page.waitForEvent("download");
    await section
      .getByRole("button", { name: "下载当前文件", exact: true })
      .click();
    const d = await pending;
    const path = join(dir, d.suggestedFilename());
    await copyFile((await d.path())!, path);
    const buffer = await readFile(path);
    paths.push(path);
    if (d.suggestedFilename().endsWith("manifest.json"))
      root = JSON.parse(buffer.toString());
    if (!d.suggestedFilename().endsWith("manifest.json"))
      totalBytes += buffer.length;
    await section
      .getByRole("button", { name: "已保存当前文件，继续", exact: true })
      .click();
    if (d.suggestedFilename().endsWith("manifest.json")) break;
  }
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "磁盘保存尚未验证",
  );
  expect(totalBytes).toBeGreaterThan(40 * 1024 * 1024);
  expect(root!.totalCards).toBe(2001);
  expect(await snapshot(page)).toBe(before);
  // Refresh clears fault hooks; restore from actual downloaded bytes, not an in-memory export shortcut.
  await page.reload();
  await page.getByText("超大旧库分页迁移", { exact: true }).click();
  await page.getByLabel("分页迁移清单").setInputFiles(paths.at(-1)!);
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "恢复暂存已打开",
  );
  await page.getByLabel("分页迁移分卷").setInputFiles(paths.slice(0, -1));
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "整套验证完成",
    { timeout: 60000 },
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "验证完成后原子替换", exact: true })
    .click();
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "完整提交成功",
    { timeout: 60000 },
  );
  expect(await snapshot(page)).toBe(before);
  await rm(dir, { recursive: true, force: true });
  console.log(
    "R5_STREAM_DOWNLOAD " +
      JSON.stringify({
        cards: 2001,
        totalBytes,
        parts: paths.length - 1,
        noDirectoryAPI: true,
        workspaceAddsBlocked: true,
        realDownloadsRestored: true,
      }),
  );
});
test("R5 cancel and Blob failure during zero-staging downloads retain originals and identify partial files", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
  });
  await open(page);
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "逐卷下载（无需暂存空间）", exact: true })
    .click();
  const section = page.getByRole("region", { name: "无需暂存的逐卷下载" });
  await expect(section).toBeVisible();
  const download = page.waitForEvent("download");
  await section
    .getByRole("button", { name: "下载当前文件", exact: true })
    .click();
  expect((await download).suggestedFilename()).not.toContain("manifest");
  await page.getByRole("button", { name: "取消或暂停当前迁移" }).click();
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "不完整",
  );
  await expect(page.getByTestId("direct-download-progress")).toContainText(
    "已请求下载 1 个文件",
  );
  expect(await snapshot(page)).toBe(before);
  await page
    .getByRole("button", { name: "逐卷下载（无需暂存空间）", exact: true })
    .click();
  await expect(section).toBeVisible();
  const partial = page.waitForEvent("download");
  await section
    .getByRole("button", { name: "下载当前文件", exact: true })
    .click();
  expect((await partial).suggestedFilename()).not.toContain("manifest");
  await section
    .getByRole("button", { name: "已保存当前文件，继续", exact: true })
    .click();
  await expect(section).toContainText("manifest.json");
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new DOMException(
        "R5 synthetic download allocation full",
        "QuotaExceededError",
      );
    };
  });
  await section
    .getByRole("button", { name: "下载当前文件", exact: true })
    .click();
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "download allocation full",
  );
  await expect(section).toBeHidden();
  expect(await snapshot(page)).toBe(before);
});
