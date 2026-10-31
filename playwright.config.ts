import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: process.env.TEST_WEBKIT
    ? [{ name: "webkit-mobile", use: { ...devices["iPhone 13"] } }]
    : [
        {
          name: "chromium",
          use: {
            ...devices["Desktop Chrome"],
            launchOptions: { executablePath: process.env.CHROMIUM_PATH },
          },
        },
        {
          name: "chromium-mobile",
          use: {
            ...devices["Pixel 7"],
            launchOptions: { executablePath: process.env.CHROMIUM_PATH },
          },
        },
        {
          name: "ux1-desktop",
          testMatch: "ux1.spec.ts",
          use: {
            ...devices["Desktop Chrome"],
            viewport: { width: 1363, height: 936 },
            launchOptions: { executablePath: process.env.CHROMIUM_PATH },
          },
        },
        {
          name: "ux1-mobile",
          testMatch: "ux1.spec.ts",
          use: {
            ...devices["Pixel 7"],
            viewport: { width: 390, height: 844 },
            launchOptions: { executablePath: process.env.CHROMIUM_PATH },
          },
        },
        {
          name: "ux1-large",
          testMatch: "ux1.spec.ts",
          use: {
            ...devices["Pixel 7"],
            viewport: { width: 390, height: 844 },
            launchOptions: { executablePath: process.env.CHROMIUM_PATH },
          },
        },
      ],
  webServer: {
    command: "node scripts/preview.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: false,
  },
});
