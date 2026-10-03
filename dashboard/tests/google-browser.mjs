import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(
  "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
);
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:4175");
  await assert.equal(await page.locator("#google-connect").isDisabled(), true);
  await page.route("**/api/google/status", (r) =>
    r.fulfill({
      json: { configured: true, connected: true, email: "owner@example.com" },
    }),
  );
  await page.route("**/api/google/calendar?*", (r) =>
    r.fulfill({
      json: {
        events: [
          {
            id: "live",
            title: "실제 일정 테스트",
            start: "2026-10-03T09:00:00+09:00",
            end: "2026-10-03T10:00:00+09:00",
            allDay: false,
          },
          {
            id: "all",
            title: "종일 테스트",
            start: "2026-10-03",
            end: "2026-10-04",
            allDay: true,
          },
        ],
      },
    }),
  );
  await page.reload();
  await page.locator("#google-calendar").click();
  await page.getByText("실제 일정 테스트", { exact: true }).waitFor();
  assert.equal(await page.locator("#add-event").isDisabled(), true);
  assert.equal(await page.locator("#agenda [data-edit]").count(), 0);
  assert.match(await page.locator("#agenda").textContent(), /종일 테스트/);
  await page.locator("#todo-list input").first().check();
  await page.locator("#google-example").click();
  assert.equal(await page.getByText("하루 계획", { exact: true }).count(), 1);
  assert.equal(await page.locator("#add-event").isDisabled(), false);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.route("**/api/google/calendar?*", (r) =>
    r.fulfill({
      status: 401,
      json: { error: "Google 로그인이 만료됐습니다." },
    }),
  );
  await page.locator("#google-calendar").click();
  await page
    .getByText("Google 로그인이 만료됐습니다.", { exact: true })
    .waitFor();
  await page.route("**/api/google/logout", (r) =>
    r.fulfill({ json: { connected: false, revoked: true } }),
  );
  await page.locator("#google-disconnect").click();
  await page.getByText("연결 해제됨 · 예시 모드", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Google UI: unconfigured, read-only live view, all-day, example restore, expiry, logout, 3 widths passed; external requests mocked.",
  );
} finally {
  await browser.close();
}
