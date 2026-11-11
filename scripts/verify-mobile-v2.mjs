import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results/interactive", { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const errors = [],
  textures = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
p.on("request", (r) => {
  if (r.url().includes("/textures/")) textures.push(r.url());
});
const wait = () =>
  p.waitForFunction(
    () => {
      const s = window.__planetCamera.snapshot();
      return s.introDone && s.settled && !s.moving;
    },
    {},
    { timeout: 16000 },
  );
const choose = async (name) => {
  await p.getByRole("button", { name: "Открыть меню планет" }).tap();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .tap();
  await wait();
};
try {
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5175", {
    waitUntil: "networkidle",
  });
  await p.waitForFunction(
    () => window.__planetCamera?.snapshot().introDone,
    {},
    { timeout: 15000 },
  );
  assert.equal(textures.filter((t) => t.includes("/desktop/")).length, 0);
  const screen = await p.evaluate(
    () => window.__planetCamera.snapshot().screen,
  );
  assert.ok(
    screen.every((s) => s.x > 0 && s.x < 390 && s.y > 0 && s.y < 844),
    "overview does not fit",
  );
  await p.screenshot({ path: "test-results/interactive/mobile-overview.png" });
  for (const [name, i] of [
    ["Солнце", 0],
    ["Меркурий", 1],
    ["Венера", 2],
    ["Земля", 3],
    ["Марс", 4],
    ["Юпитер", 5],
    ["Сатурн", 6],
    ["Уран", 7],
    ["Нептун", 8],
  ]) {
    await choose(name);
    const bounds = await p.evaluate((i) => window.__planetCamera.bounds(i), i),
      copy = await p.locator(".planet-copy").boundingBox();
    assert.ok(
      bounds.xMin >= -2 &&
        bounds.xMax <= 392 &&
        bounds.yMin >= 0 &&
        bounds.yMax < 844,
      "full planet clipped",
    );
    assert.ok(bounds.yMax < copy.y + 3, `${name}: planet overlaps copy`);
    for (const level of ["full", "close"]) {
      if (level === "close") {
        await p
          .getByRole("button", { name: "Следующий этап", exact: true })
          .tap();
        await wait();
      }
      const info = await p.locator(".planet-copy").boundingBox(),
        footer = await p.locator(".stage-indicator").boundingBox();
      const bodyBounds = await p.evaluate(
        (i) => window.__planetCamera.bounds(i),
        i,
      );
      assert.ok(
        bodyBounds.yMax < info.y + 3,
        `${name} ${level}: geometry overlaps copy`,
      );
      assert.ok(
        info.y + info.height < footer.y,
        `${name} ${level}: text overlaps footer`,
      );
      assert.equal(
        await p.evaluate(() => document.documentElement.scrollWidth),
        390,
      );
      await p.screenshot({
        path: `test-results/interactive/mobile-${i}-${level}.png`,
      });
    }
    console.log(`PASS mobile ${name} full / close`);
  }
  await p.setViewportSize({ width: 375, height: 667 });
  await wait();
  await choose("Меркурий");
  let copy = await p.locator(".planet-copy").boundingBox(),
    footer = await p.locator(".stage-indicator").boundingBox();
  assert.ok(copy.y + copy.height < footer.y, "small phone content overlap");
  await p.screenshot({ path: "test-results/interactive/mobile-small.png" });
  await p.getByRole("button", { name: "Следующий этап", exact: true }).tap();
  await wait();
  copy = await p.locator(".planet-copy").boundingBox();
  footer = await p.locator(".stage-indicator").boundingBox();
  assert.ok(
    copy.y + copy.height < footer.y,
    "small phone close content overlap",
  );
  const shortBounds = await p.evaluate(() => window.__planetCamera.bounds(1));
  assert.ok(
    shortBounds.yMax < copy.y + 3,
    "small phone close geometry overlaps copy",
  );
  await p.screenshot({
    path: "test-results/interactive/mobile-small-close.png",
  });
  await p.setViewportSize({ width: 768, height: 1024 });
  await wait();
  await p.getByRole("button", { name: "Общий вид системы" }).tap();
  await wait();
  assert.ok(
    (await p.evaluate(() => window.__planetCamera.snapshot().screen)).every(
      (s) => s.x > 0 && s.x < 768 && s.y > 0 && s.y < 1024,
    ),
  );
  await choose("Сатурн");
  await p.screenshot({ path: "test-results/interactive/tablet.png" });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await wait();
  const before = await p.evaluate(
    () => window.__planetCamera.snapshot().rotation,
  );
  await p.waitForTimeout(500);
  assert.equal(
    await p.evaluate(() => window.__planetCamera.snapshot().rotation),
    before,
  );
  const button = await p
    .getByRole("button", { name: "Следующий этап", exact: true })
    .boundingBox();
  assert.ok(button.width >= 44 && button.height >= 44);
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(
    "test-results/interactive/mobile-report.json",
    JSON.stringify({ result: "PASS", errors, desktopTextures: 0 }, null, 2),
  );
  console.log(
    "PASS native touch controls, 2K tier, phone/tablet layout and reduced motion",
  );
} finally {
  await b.close();
}
