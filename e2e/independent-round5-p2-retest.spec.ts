import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const panel = (page: Page) =>
  page.getByRole("region", { name: "无需暂存的逐卷下载" });
const feedback = (page: Page) => page.getByTestId("download-feedback");
async function start(page: Page) {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "体验示例" }).click();
  await expect(page.locator("article h2")).toBeAttached();
  await page.goto("/migration.html");
  await page.getByText("超大旧库分页迁移", { exact: true }).click();
}
async function snapshot(page: Page) {
  return page.evaluate(() => new Promise<string>((resolve, reject) => {
    const request = indexedDB.open("mindflow-v1");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["cards", "reading", "settings"]);
      const requests = ["cards", "reading", "settings"].map((store) =>
        tx.objectStore(store).getAll(),
      );
      tx.oncomplete = () => {
        db.close();
        resolve(JSON.stringify(requests.map((item) => item.result)));
      };
      tx.onerror = () => reject(tx.error);
    };
  }));
}
async function begin(page: Page) {
  await page.getByRole("button", {
    name: "逐卷下载（无需暂存空间）", exact: true,
  }).click();
  await expect(panel(page)).toBeVisible();
  await expect(feedback(page)).toHaveCount(0);
  await expect(page.getByTestId("direct-download-progress")).toHaveCount(0);
  await expect(panel(page).getByRole("button", {
    name: "已保存当前文件，继续", exact: true,
  })).toBeDisabled();
}
async function request(page: Page) {
  const event = page.waitForEvent("download");
  await panel(page).getByRole("button", {
    name: "下载当前文件", exact: true,
  }).click();
  const file = await event;
  expect(await file.failure()).toBeNull();
  const bytes = await readFile((await file.path())!);
  await expect(feedback(page)).toHaveAttribute("data-download-state", "requested");
  await expect(feedback(page)).toContainText("无法确认");
  return { bytes, name: file.suggestedFilename() };
}

test("B-P2: acknowledging one file cannot confirm the next file or disk persistence; all requests remain unverified", async ({ page }, info) => {
  await start(page);
  const before = await snapshot(page);
  await begin(page);
  const part = await request(page);
  await panel(page).getByRole("button", {
    name: "已保存当前文件，继续", exact: true,
  }).click();
  await expect(panel(page)).toContainText("manifest.json");
  await expect(feedback(page)).toHaveCount(0);
  await expect(panel(page).getByRole("button", {
    name: "已保存当前文件，继续", exact: true,
  })).toBeDisabled();
  await expect(page.getByTestId("paged-migration-state")).toContainText("不代表磁盘保存已确认");
  const root = await request(page);
  const parsed = JSON.parse(root.bytes.toString());
  expect(parsed.totalParts).toBe(1);
  expect(parsed.totalBytes).toBe(part.bytes.length);
  await panel(page).getByRole("button", {
    name: "已保存当前文件，继续", exact: true,
  }).click();
  await expect(panel(page)).toBeHidden();
  await expect(page.getByTestId("paged-migration-state")).toContainText("磁盘保存尚未验证");
  await expect(feedback(page)).toHaveAttribute("data-download-state", "requested");
  await expect(feedback(page)).toContainText("无法确认");
  expect(await snapshot(page)).toBe(before);
  await begin(page);
  await page.getByRole("button", { name: "取消或暂停当前迁移" }).click();
  await expect(panel(page)).toBeHidden();
  await expect(feedback(page)).toHaveAttribute("data-download-state", "cancelled");
  expect(await snapshot(page)).toBe(before);
  console.log("B_P2_FILE_TRANSITIONS " + JSON.stringify({
    project: info.project.name, actualFiles: [part.name, root.name],
    partBytes: part.bytes.length, nextFileReset: true,
    acknowledgementIsNotSystemVerification: true, nextAttemptReset: true,
    sourcePreserved: true,
  }));
});

test("B-P2: an exception after an actual download overrides requested state; retry starts clean and preserves the source", async ({ page }, info) => {
  await start(page);
  const before = await snapshot(page);
  await begin(page);
  const first = await request(page);
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        HTMLAnchorElement.prototype.click = original;
        throw new DOMException("B P2 retry fault after actual request", "QuotaExceededError");
      }
      return original.call(this);
    };
  });
  await panel(page).getByRole("button", { name: "下载当前文件", exact: true }).click();
  await expect(panel(page)).toBeHidden();
  await expect(feedback(page)).toHaveAttribute("data-download-state", "failed");
  await expect(feedback(page)).toContainText("下载失败");
  await expect(page.getByTestId("paged-migration-state")).toContainText("操作未完成");
  await expect(page.getByTestId("direct-download-progress")).toContainText("已请求下载 1 个文件");
  await expect(page.getByTestId("direct-download-progress")).toContainText("无法确认");
  expect(await snapshot(page)).toBe(before);
  await begin(page);
  const retry = await request(page);
  // A new export has a fresh envelope, but the card business data must be identical.
  const firstData = JSON.parse(first.bytes.toString()).payload;
  const retryData = JSON.parse(retry.bytes.toString()).payload;
  expect(firstData.cards.length).toBeGreaterThan(0);
  expect(firstData.reading.length).toBe(firstData.cards.length);
  expect(retryData).toEqual(firstData);
  await expect(feedback(page)).not.toContainText("B P2 retry fault");
  await page.getByRole("button", { name: "取消或暂停当前迁移" }).click();
  await expect(panel(page)).toBeHidden();
  expect(await snapshot(page)).toBe(before);
  console.log("B_P2_FAILURE_TRANSITIONS " + JSON.stringify({
    project: info.project.name, actualFirstDownload: true,
    followingSynchronousFailure: "QuotaExceededError", failedStateOverridesRequested: true,
    retryResetBeforeRequest: true, realRetryDownload: true, sourcePreserved: true,
  }));
});
