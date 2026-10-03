import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile, readdir } from "node:fs/promises";
const require = createRequire(
  "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
);
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const baseURL = process.env.DASHBOARD_URL ?? "http://localhost:4174";
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const results = [];
try {
  await page.goto(baseURL);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    results.push(`${width}px no overflow`);
  }
  await page.locator("#add-todo").click();
  await page.getByLabel("할 일", { exact: true }).fill("빌드 결과 확인");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  assert.equal(
    await page.getByText("빌드 결과 확인", { exact: true }).count(),
    1,
  );
  await page.reload();
  assert.equal(
    await page.getByText("빌드 결과 확인", { exact: true }).count(),
    1,
  );
  results.push("built todo add and persistence");
  await page.goto(baseURL + "/?state=empty");
  assert.equal(await page.locator(".empty").count(), 4);
  results.push("built empty state");
  const assets = (await readdir("dist")).sort();
  assert.deepEqual(assets, ["app.js", "index.html", "modules", "styles.css"]);
  assert.deepEqual((await readdir("api/google")).sort(), ["[action].js"]);
  results.push("browser assets only; Vercel API source separate");
  assert.deepEqual(errors, []);
  await writeFile(
    "../../review/build-preview-results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
