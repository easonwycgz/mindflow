import { test, expect, type Page } from "@playwright/test";
import { mkdtemp, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
async function migratePage(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例" }).click();
  await expect(page.locator("article h2")).toBeAttached();
  await page.goto("/migration.html");
  await page.getByText("超大旧库分页迁移", { exact: true }).click();
}
// New 48+MiB stress work has a measured multi-second lifecycle; wait for its completion signal, then retain all assertions.
async function migrationIdle(page: Page) {
  await expect(
    page.getByRole("button", { name: "取消或暂停当前迁移" }),
  ).toBeHidden({ timeout: 60000 });
}
async function digest(page: Page) {
  return page.evaluate(async () => {
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("mindflow-v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const canonical = (value: unknown): string =>
      Array.isArray(value)
        ? "[" + value.map(canonical).join(",") + "]"
        : value && typeof value === "object"
          ? "{" +
            Object.keys(value)
              .sort()
              .map(
                (k) =>
                  JSON.stringify(k) +
                  ":" +
                  canonical((value as Record<string, unknown>)[k]),
              )
              .join(",") +
            "}"
          : JSON.stringify(value);
    const sha = async (value: unknown) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonical(value)),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const records: string[] = [];
    let last = "";
    while (true) {
      const batch = await new Promise<
        {
          id: string;
          hash: string;
          content: unknown;
          createdAt: number;
          updatedAt: number;
        }[]
      >((resolve) => {
        const tx = connection.transaction("cards"),
          items: {
            id: string;
            hash: string;
            content: unknown;
            createdAt: number;
            updatedAt: number;
          }[] = [];
        const r = tx
          .objectStore("cards")
          .openCursor(IDBKeyRange.lowerBound(last, true));
        r.onsuccess = () => {
          const c = r.result;
          if (c) {
            items.push(c.value);
            if (items.length < 4) c.continue();
          }
        };
        tx.oncomplete = () => resolve(items);
      });
      if (!batch.length) break;
      const reading = await new Promise<unknown[]>((resolve) => {
        const tx = connection.transaction("reading"),
          items: unknown[] = [];
        batch.forEach((c, i) => {
          tx.objectStore("reading").get(c.id).onsuccess = (e) => {
            items[i] = (e.target as IDBRequest).result;
          };
        });
        tx.oncomplete = () => resolve(items);
      });
      for (const [i, c] of batch.entries()) {
        if ((await sha(c.content)) !== c.hash)
          throw Error("recomputed content hash mismatch");
        records.push(
          canonical({
            id: c.id,
            hash: c.hash,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            reading: reading[i],
          }),
        );
      }
      last = batch.at(-1)!.id;
    }
    const settings = await new Promise<unknown>((resolve) => {
      const r = connection
        .transaction("settings")
        .objectStore("settings")
        .get("main");
      r.onsuccess = () => resolve(r.result);
    });
    connection.close();
    return { count: records.length, digest: await sha(records), settings };
  });
}
test("R4 combined stress: 2001 cards AND >40MiB, bounded export, refresh-resume, quota rollback and exact restore", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await migratePage(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("mindflow-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction(["cards", "reading", "settings"], "readwrite");
      for (const n of ["cards", "reading", "settings"])
        tx.objectStore(n).clear();
      tx.oncomplete = () => resolve();
    });
    const base = {
      schema_version: "1.0",
      title: "",
      hook: "合成",
      summary: "合成摘要",
      topic_type: "technical",
      tags: ["stress"],
      key_takeaways: ["test"],
      branches: [
        {
          id: "r",
          title: "根",
          summary: "摘要",
          content: "x".repeat(15000),
          children: [
            {
              id: "n",
              title: "子",
              summary: "摘要",
              content: "y".repeat(9000),
              children: [],
            },
          ],
        },
      ],
      faq: [{ question: "问", answer: "答", basis: "supplement" }],
      caveats: [],
      source: { chat_title: null, chat_url: null },
    };
    const canonical = (v: unknown): string =>
      Array.isArray(v)
        ? "[" + v.map(canonical).join(",") + "]"
        : v && typeof v === "object"
          ? "{" +
            Object.keys(v)
              .sort()
              .map(
                (k) =>
                  JSON.stringify(k) +
                  ":" +
                  canonical((v as Record<string, unknown>)[k]),
              )
              .join(",") +
            "}"
          : JSON.stringify(v);
    for (let start = 0; start < 2001; start += 8) {
      const batch: {
        id: string;
        hash: string;
        content: typeof base;
        createdAt: number;
        updatedAt: number;
      }[] = [];
      for (let i = start; i < Math.min(2001, start + 8); i++) {
        const content = { ...base, title: "R4 stress " + i },
          hash = Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(canonical(content)),
              ),
            ),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        batch.push({
          id: crypto.randomUUID(),
          hash,
          content,
          createdAt: 1,
          updatedAt: 2,
        });
      }
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["cards", "reading"], "readwrite");
        for (const c of batch) {
          tx.objectStore("cards").add(c);
          tx.objectStore("reading").add({
            cardId: c.id,
            favorite: true,
            section: "tree",
            nodeId: "n",
            scroll: 77,
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    await new Promise<void>((resolve) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put({
        id: "main",
        fontSize: "normal",
        lastCardId: null,
      });
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  const expected = await digest(page),
    heaps: number[] = [];
  const heap = () =>
    page.evaluate(
      () =>
        (performance as unknown as { memory?: { usedJSHeapSize: number } })
          .memory?.usedJSHeapSize ?? 0,
    );
  heaps.push(await heap());
  await page.getByRole("button", { name: "准备分页迁出", exact: true }).click();
  await migrationIdle(page);
  await expect(
    page.getByRole("button", { name: "下载分页完成清单" }),
  ).toBeVisible();
  const meta = await page.evaluate(
    () =>
      new Promise<{
        id: string;
        parts: number;
        bytes: number;
        maxPartBytes: number;
        maxBatchCards: number;
      }>((resolve) => {
        const r = indexedDB.open("mindflow-migration-workspace-v1");
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("jobs").objectStore("jobs").getAll();
          q.onsuccess = () => {
            resolve(
              q.result.find((j: { kind: string }) => j.kind === "export"),
            );
            db.close();
          };
        };
      }),
  );
  expect(meta.bytes).toBeGreaterThan(40 * 1024 * 1024);
  expect(meta.maxBatchCards).toBeLessThanOrEqual(4);
  expect(meta.maxPartBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  heaps.push(await heap());
  const dir = await mkdtemp(join(tmpdir(), "mindflow-r4-ui-"));
  try {
    const files: string[] = [];
    for (let n = 0; n <= meta.parts; n++) {
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", {
          name: n === 0 ? "下载分页完成清单" : `下载分页卷 ${n}`,
          exact: true,
        })
        .click();
      const file = await pending,
        path = join(dir, file.suggestedFilename());
      await copyFile((await file.path())!, path);
      files.push(path);
    }
    expect(JSON.parse(await readFile(files[0], "utf8")).totalCards).toBe(2001);
    expect(await digest(page)).toEqual(expected);
    await page.getByLabel("分页迁移清单").setInputFiles(files[0]);
    await expect(
      page.getByRole("button", { name: "选择下一批分页卷" }),
    ).toBeEnabled();
    await page.getByLabel("分页迁移分卷").setInputFiles(files[1]);
    await expect(page.getByTestId("paged-migration-state")).toContainText(
      "已验证 1/",
    );
    await page.reload();
    await page.getByText("超大旧库分页迁移", { exact: true }).click();
    await page.getByText("继续或清理本机迁移暂存", { exact: true }).click();
    await page
      .getByRole("button", { name: /打开暂存/ })
      .first()
      .click();
    // Select explicit restore job rather than an export job in the recent list.
    const restoreButton = page
      .locator(".large-migration details div")
      .filter({ hasText: "restore" })
      .getByRole("button", { name: /打开暂存/ });
    await restoreButton.click();
    await page.getByLabel("分页迁移分卷").setInputFiles(files.slice(2));
    await migrationIdle(page);
    await expect(
      page.getByRole("button", { name: "验证完成后原子替换" }),
    ).toBeEnabled();
    heaps.push(await heap());
    // Hold staging reads after the destination clear succeeds but before its transaction can commit.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.clear;
      IDBObjectStore.prototype.clear = function () {
        const request = original.call(this);
        if (this.name === "cards")
          request.addEventListener(
            "success",
            () => {
              const r = indexedDB.open("mindflow-migration-workspace-v1");
              r.onsuccess = () => {
                const connection = r.result,
                  tx = connection.transaction("cards", "readwrite");
                const keep = () => {
                  tx.objectStore("cards").getAllKeys().onsuccess = () => {
                    Object.assign(window, { r4Cleared: true });
                    keep();
                  };
                };
                keep();
              };
            },
            { once: true },
          );
        return request;
      };
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "验证完成后原子替换" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => !!(window as unknown as { r4Cleared?: boolean }).r4Cleared,
        ),
      )
      .toBe(true);
    await page.reload();
    expect(await digest(page)).toEqual(expected);
    await page.getByText("超大旧库分页迁移", { exact: true }).click();
    await page.getByText("继续或清理本机迁移暂存", { exact: true }).click();
    await page
      .locator(".large-migration details div")
      .filter({ hasText: "restore" })
      .getByRole("button", { name: /打开暂存/ })
      .click();
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.add;
      let writes = 0;
      Object.assign(window, {
        r4FixAdd: () => {
          IDBObjectStore.prototype.add = original;
        },
      });
      IDBObjectStore.prototype.add = function (
        ...args: Parameters<IDBObjectStore["add"]>
      ) {
        if (this.name === "cards" && ++writes === 10)
          throw new DOMException(
            "synthetic promotion quota",
            "QuotaExceededError",
          );
        return original.apply(this, args);
      };
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "验证完成后原子替换" }).click();
    await expect(page.getByTestId("paged-migration-state")).toContainText(
      "synthetic promotion quota",
    );
    expect(await digest(page)).toEqual(expected);
    await page.evaluate(() => {
      (window as unknown as { r4FixAdd: () => void }).r4FixAdd();
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "验证完成后原子替换" }).click();
    await migrationIdle(page);
    await expect(page.getByTestId("paged-migration-state")).toContainText(
      "完整提交成功",
    );
    expect(await digest(page)).toEqual(expected);
    heaps.push(await heap());
    const metrics = {
      project: info.project.name,
      cards: expected.count,
      totalExportBytes: meta.bytes,
      maxPartBytes: meta.maxPartBytes,
      maxBatchCards: meta.maxBatchCards,
      observedJSHeapBytes: heaps,
      note: "Chromium reported phase samples, not a process/native peak-memory guarantee",
    };
    console.log("R4_STRESS_METRICS " + JSON.stringify(metrics));
    await info.attach("synthetic-stress-metrics", {
      body: JSON.stringify(metrics),
      contentType: "application/json",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("R4 page refresh during blocked export leaves original intact and no completion manifest", async ({
  page,
}) => {
  await migratePage(page);
  const before = await digest(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open("mindflow-migration-workspace-v1");
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("files", "readwrite");
          const keep = () => {
            tx.objectStore("files").getAllKeys().onsuccess = keep;
          };
          keep();
          resolve();
        };
      }),
  );
  await page.getByRole("button", { name: "准备分页迁出", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "取消或暂停当前迁移" }),
  ).toBeVisible();
  await page.reload();
  expect(await digest(page)).toEqual(before);
  const incomplete = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const r = indexedDB.open("mindflow-migration-workspace-v1");
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("jobs").objectStore("jobs").getAll();
          q.onsuccess = () => {
            resolve(
              q.result.every(
                (j: { root?: unknown; state: string }) =>
                  !j.root && j.state !== "ready",
              ),
            );
            db.close();
          };
        };
      }),
  );
  expect(incomplete).toBe(true);
});
