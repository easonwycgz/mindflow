import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const r = indexedDB.open("mindflow-v1");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction(["cards", "reading", "settings"]),
            qs = ["cards", "reading", "settings"].map((n) =>
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
const panel = (page: Page) =>
  page.getByRole("region", { name: "无需暂存的逐卷下载" });
async function begin(page: Page) {
  await page
    .getByRole("button", { name: "逐卷下载（无需暂存空间）", exact: true })
    .click();
  await expect(panel(page)).toBeVisible();
  await expect(
    panel(page).getByRole("button", {
      name: "已保存当前文件，继续",
      exact: true,
    }),
  ).toBeDisabled();
}
async function request(page: Page) {
  const pending = page.waitForEvent("download");
  await panel(page)
    .getByRole("button", { name: "下载当前文件", exact: true })
    .click();
  return pending;
}
async function uncertain(page: Page) {
  await expect(page.getByTestId("download-feedback")).toHaveAttribute(
    "data-download-state",
    "requested",
  );
  await expect(page.getByTestId("download-feedback")).toContainText("无法确认");
  await expect(page.getByTestId("download-feedback")).toContainText("下载记录");
  await expect(page.getByTestId("direct-download-progress")).toContainText(
    "已成功保存的文件（如有）",
  );
  await expect(page.getByTestId("direct-download-progress")).not.toContainText(
    "这些文件仍在设备下载位置",
  );
  await expect(page.getByTestId("paged-migration-state")).not.toContainText(
    "全部分卷和完成清单已请求下载",
  );
}
test("P2 actual successful download remains unconfirmed in UI; repeated requests and migration cancellation never promise device files", async ({
  page,
}) => {
  await start(page);
  const before = await snapshot(page);
  await begin(page);
  const one = await request(page);
  expect(await one.failure()).toBeNull();
  const bytes = await readFile((await one.path())!);
  expect(JSON.parse(bytes.toString()).version).toBe(1);
  await uncertain(page);
  const duplicate = await request(page);
  expect(await readFile((await duplicate.path())!)).toEqual(bytes);
  await uncertain(page);
  await expect(page.getByTestId("direct-download-progress")).toContainText(
    "已请求下载 1 个文件",
  );
  await page.getByRole("button", { name: "取消或暂停当前迁移" }).click();
  await expect(page.getByTestId("download-feedback")).toHaveAttribute(
    "data-download-state",
    "cancelled",
  );
  await expect(page.getByTestId("download-feedback")).toContainText(
    "迁出已取消",
  );
  await expect(page.getByTestId("download-feedback")).toContainText(
    "保存结果仍无法确认",
  );
  await expect(panel(page)).toBeHidden();
  expect(await snapshot(page)).toBe(before);
});
test("P2 user reports cancelled download, migration stops safely and a fresh request can retry", async ({
  page,
}) => {
  await start(page);
  const before = await snapshot(page);
  await begin(page);
  await request(page);
  await panel(page)
    .getByRole("button", { name: "本次下载已取消", exact: true })
    .click();
  await expect(page.getByTestId("download-feedback")).toHaveAttribute(
    "data-download-state",
    "cancelled",
  );
  await expect(page.getByTestId("download-feedback")).toContainText(
    "你已报告下载已取消",
  );
  await expect(page.getByTestId("paged-migration-state")).toContainText(
    "不完整",
  );
  await expect(panel(page)).toBeHidden();
  expect(await snapshot(page)).toBe(before);
  await begin(page);
  const retry = await request(page);
  expect(await retry.failure()).toBeNull();
  expect(
    JSON.parse((await readFile((await retry.path())!)).toString()).version,
  ).toBe(1);
  await uncertain(page);
  await page.getByRole("button", { name: "取消或暂停当前迁移" }).click();
  expect(await snapshot(page)).toBe(before);
});
for (const [errorName, state, message] of [
  ["NotAllowedError", "blocked", "下载未能启动或被浏览器阻止"],
  ["SecurityError", "blocked", "下载未能启动或被浏览器阻止"],
  ["AbortError", "cancelled", "下载已取消"],
  ["QuotaExceededError", "failed", "下载失败"],
]) {
  test(`P2 observable ${errorName} safely stops, reports ${state}, and retries through a real download`, async ({
    page,
  }) => {
    await start(page);
    const before = await snapshot(page);
    await begin(page);
    await page.evaluate((errorName) => {
      const original = HTMLAnchorElement.prototype.click;
      Object.assign(window, {
        restoreDownloadClick: () => {
          HTMLAnchorElement.prototype.click = original;
        },
      });
      HTMLAnchorElement.prototype.click = function () {
        if (this.download)
          throw new DOMException("P2 synthetic download signal", errorName);
        return original.call(this);
      };
    }, errorName);
    await panel(page)
      .getByRole("button", { name: "下载当前文件", exact: true })
      .click();
    await expect(page.getByTestId("download-feedback")).toHaveAttribute(
      "data-download-state",
      state,
    );
    await expect(page.getByTestId("download-feedback")).toContainText(message);
    await expect(page.getByTestId("download-feedback")).toContainText(
      "重新尝试",
    );
    await expect(page.getByTestId("paged-migration-state")).toContainText(
      "操作未完成",
    );
    await expect(panel(page)).toBeHidden();
    await expect(page.getByTestId("direct-download-progress")).toHaveCount(0);
    expect(await snapshot(page)).toBe(before);
    await page.evaluate(() => {
      (
        window as unknown as { restoreDownloadClick: () => void }
      ).restoreDownloadClick();
    });
    await begin(page);
    const actual = await request(page);
    expect(await actual.failure()).toBeNull();
    expect(
      JSON.parse((await readFile((await actual.path())!)).toString()).version,
    ).toBe(1);
    await uncertain(page);
    await page.getByRole("button", { name: "取消或暂停当前迁移" }).click();
    expect(await snapshot(page)).toBe(before);
  });
}
test.describe("P2 real browser refusal has no webpage receipt", () => {
  test.use({ acceptDownloads: false });
  test("actual denied requests stay unknown until the user reports blocked; retry never inherits a saved status", async ({
    page,
  }, info) => {
    await start(page);
    const before = await snapshot(page);
    for (let attempt = 0; attempt < 2; attempt++) {
      await begin(page);
      const denied = await request(page),
        failure = await denied.failure();
      expect(failure).toBeTruthy();
      await uncertain(page);
      await expect(panel(page)).toBeVisible();
      await panel(page)
        .getByRole("button", { name: "下载未启动或被阻止", exact: true })
        .click();
      await expect(page.getByTestId("download-feedback")).toHaveAttribute(
        "data-download-state",
        "blocked",
      );
      await expect(page.getByTestId("download-feedback")).toContainText(
        "你已报告下载未启动或被浏览器阻止",
      );
      await expect(panel(page)).toBeHidden();
      await expect(page.getByTestId("paged-migration-state")).toContainText(
        "不完整",
      );
      expect(await snapshot(page)).toBe(before);
      console.log(
        "P2_NATIVE_DENIAL " +
          JSON.stringify({
            project: info.project.name,
            attempt,
            actualFailure: failure,
            webpageStateBeforeReport: "requested/unconfirmed",
            webpageStateAfterReport: "blocked",
            sourcePreserved: true,
          }),
      );
    }
  });
});
