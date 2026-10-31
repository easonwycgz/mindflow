import { test, expect, type Page } from "@playwright/test";
import {
  capacityCard,
  capacityLibrary,
} from "../tests/fixtures/libraryCapacity";
import { MAX_BACKUP_BYTES } from "../src/model";
import type { Payload } from "../src/db";
const upload = (index: number, large = false) => ({
  name: "fictional-capacity.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(capacityCard(index, large))),
});
async function seed(page: Page, payload: Payload) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "体验示例", exact: true })
    .waitFor({ state: "visible" });
  await page.evaluate(
    (p) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("mindflow-v1");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction(["cards", "reading", "settings"], "readwrite");
          for (const name of ["cards", "reading", "settings"])
            tx.objectStore(name).clear();
          for (const c of p.cards) tx.objectStore("cards").add(c);
          for (const state of p.reading) tx.objectStore("reading").add(state);
          tx.objectStore("settings").put(p.settings);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    payload,
  );
  await page.reload();
  await expect(page.locator("article h2")).toHaveText(
    payload.cards[0].content.title,
  );
}
async function snapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, { count: number; hash: string }>>(
        (resolve, reject) => {
          const r = indexedDB.open("mindflow-v1");
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction(["cards", "reading", "settings"]),
              requests = ["cards", "reading", "settings"].map((name) => ({
                name,
                request: tx.objectStore(name).getAll(),
              }));
            tx.oncomplete = async () => {
              db.close();
              const result: Record<string, { count: number; hash: string }> =
                {};
              for (const { name, request } of requests) {
                const bytes = new TextEncoder().encode(
                  JSON.stringify(request.result),
                );
                const digest = await crypto.subtle.digest("SHA-256", bytes);
                result[name] = {
                  count: request.result.length,
                  hash: Array.from(new Uint8Array(digest))
                    .map((n) => n.toString(16).padStart(2, "0"))
                    .join(""),
                };
              }
              resolve(result);
            };
            tx.onerror = () => reject(tx.error);
          };
        },
      ),
  );
}
async function discover(page: Page) {
  await page.getByRole("button", { name: "随机一张", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "临时发现" }),
  ).toBeVisible();
}
test("B-UX1-001 real file: 499/500 succeed, 501 reports the 500-card business limit with exact three-store preservation", async ({
  page,
}) => {
  test.setTimeout(60000);
  await seed(page, await capacityLibrary(498));
  for (const index of [498, 499]) {
    await page
      .getByLabel("导入卡片", { exact: true })
      .setInputFiles(upload(index));
    await expect(page.locator("article h2")).toHaveText(
      capacityCard(index).title,
    );
    expect((await snapshot(page)).cards.count).toBe(index + 1);
  }
  await discover(page);
  const before = await snapshot(page);
  expect(before.cards.count).toBe(500);
  expect(before.reading.count).toBe(500);
  await page.getByLabel("导入卡片", { exact: true }).setInputFiles(upload(500));
  await expect(page.getByRole("alert")).toContainText("500 张卡片");
  await expect(page.getByRole("alert")).not.toContainText("数据库事务失败");
  await expect(page.getByRole("alert")).toContainText("备份");
  await page.waitForTimeout(250);
  expect(await snapshot(page)).toEqual(before);
});
test("40MiB real file: the existing recoverable-library budget is reported distinctly and preserves all stores", async ({
  page,
}) => {
  test.setTimeout(90000);
  const p = await capacityLibrary(22, true);
  const beforeBudget =
    Buffer.byteLength(JSON.stringify(p.cards)) + p.cards.length * 512 + 1024;
  expect(beforeBudget).toBeLessThan(MAX_BACKUP_BYTES);
  const candidateCardBytes = Buffer.byteLength(
    JSON.stringify(capacityCard(22, true)),
  );
  expect(beforeBudget + candidateCardBytes + 512).toBeGreaterThan(
    MAX_BACKUP_BYTES,
  );
  console.log(
    "FICTIONAL_LIBRARY_BUDGET",
    JSON.stringify({
      cards: 22,
      beforeBudget,
      candidateCardBytes,
      limit: MAX_BACKUP_BYTES,
    }),
  );
  await seed(page, p);
  await discover(page);
  const before = await snapshot(page);
  await page
    .getByLabel("导入卡片", { exact: true })
    .setInputFiles(upload(22, true));
  await expect(page.getByRole("alert")).toContainText("40 MiB");
  await expect(page.getByRole("alert")).not.toContainText("数据库事务失败");
  await page.waitForTimeout(250);
  expect(await snapshot(page)).toEqual(before);
});
test("real file mid-transaction failure is still classified as database failure, not library capacity", async ({
  page,
}) => {
  await seed(page, await capacityLibrary(2));
  await discover(page);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "reading")
        throw new DOMException(
          "fictional transaction fault",
          "QuotaExceededError",
        );
      return original.apply(this, args);
    };
  });
  await page.getByLabel("导入卡片", { exact: true }).setInputFiles(upload(3));
  await expect(page.getByRole("alert")).toContainText("数据库事务失败");
  await expect(page.getByRole("alert")).not.toContainText("500 张卡片");
  await expect(page.getByRole("alert")).not.toContainText("40 MiB");
  expect(await snapshot(page)).toEqual(before);
});
