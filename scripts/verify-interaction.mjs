import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results/interactive", { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const snap = () => p.evaluate(() => window.__planetCamera.snapshot());
const idle = () =>
  p.waitForFunction(
    () => {
      const s = window.__planetCamera.snapshot();
      return s.introDone && !s.moving && s.settled;
    },
    {},
    { timeout: 15000 },
  );
const stage = async (index, level) => {
  await p.waitForFunction(
    ({ index, level }) => {
      const s = window.__planetCamera.snapshot();
      return (
        s.target.kind === "planet" &&
        s.target.index === index &&
        s.target.level === level &&
        !s.moving &&
        s.settled
      );
    },
    { index, level },
    { timeout: 15000 },
  );
};
const system = async () => {
  await p.getByRole("button", { name: "Общий вид системы" }).click();
  await p.waitForFunction(
    () => {
      const s = window.__planetCamera.snapshot();
      return s.target.kind === "system" && s.settled && !s.moving;
    },
    {},
    { timeout: 14000 },
  );
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
  for (let i = 0; i < 9; i++) {
    const s = await snap(),
      point = s.screen[i];
    assert.ok(point.x > 0 && point.x < 1440 && point.y > 0 && point.y < 1000);
    await p.mouse.click(point.x, point.y);
    await p.waitForFunction(
      (i) => {
        const s = window.__planetCamera.snapshot();
        return s.target.kind === "planet" && s.target.index === i;
      },
      i,
      { timeout: 5000 },
    );
    assert.ok((await snap()).handoff.position < 1e-8);
    await system();
    console.log(`PASS 3D selection ${i}`);
  }
  const earth = (await snap()).screen[3];
  await p.mouse.click(earth.x, earth.y);
  await stage(3, "full");
  const text1 = await p.locator(".planet-narrative").innerText();
  await p.keyboard.press("ArrowRight");
  await stage(3, "close");
  assert.notEqual(await p.locator(".planet-narrative").innerText(), text1);
  await p.keyboard.press("ArrowRight");
  await stage(4, "full");
  await p.keyboard.press("ArrowLeft");
  await stage(3, "close");
  await p.keyboard.press("ArrowLeft");
  await stage(3, "full");
  await p.keyboard.press("ArrowLeft");
  await idle();
  assert.equal((await snap()).target.kind, "system");
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.waitForTimeout(200);
  await idle();
  await p.getByRole("button", { name: "Открыть меню планет" }).click();
  await p.getByRole("dialog").getByRole("button", { name: /Земля/ }).click();
  await stage(3, "full");
  const reducedFull = await snap();
  await p.screenshot({
    path: "test-results/interactive/reduced-earth-full.png",
  });
  await p.getByRole("button", { name: "Следующий этап", exact: true }).click();
  await stage(3, "close");
  assert.ok(
    (await snap()).size / reducedFull.size > 1.6,
    "reduced motion suppressed actual close-up",
  );
  await p.screenshot({
    path: "test-results/interactive/reduced-earth-close.png",
  });
  await p.getByRole("button", { name: "Предыдущий этап", exact: true }).click();
  await stage(3, "full");
  assert.ok(
    (await snap()).position.every(
      (v, axis) => Math.abs(v - reducedFull.position[axis]) < 1e-7,
    ),
  );
  console.log("PASS reduced-motion physical close-up and reverse");
  await p.emulateMedia({ reducedMotion: "no-preference" });
  await p.waitForTimeout(200);
  await idle();
  await system();
  console.log(
    "PASS direct Earth selection, two levels, Mars and logical history/redo",
  );
  const neptune = (await snap()).screen[8];
  await p.mouse.click(neptune.x, neptune.y);
  const destinations = new Set();
  for (let i = 0; i < 25; i++) {
    const s = await snap();
    destinations.add(s.target.kind === "planet" ? s.target.index : -1);
    await p.waitForTimeout(200);
  }
  await stage(8, "full");
  assert.deepEqual([...destinations], [8]);
  console.log("PASS direct Neptune flight without intermediate planet states");
  await system();
  for (let i = 0; i < 5; i++) {
    await p
      .getByRole("button", { name: "Следующий этап", exact: true })
      .click();
    await p.waitForTimeout(80);
  }
  await stage(2, "full");
  assert.ok((await snap()).handoff.position < 1e-8);
  assert.ok((await snap()).handoff.angle < 1e-6);
  console.log("PASS rapid repeated arrows cancel and rebase correctly");
  await p.getByRole("button", { name: "Открыть меню планет" }).click();
  await p
    .getByRole("dialog")
    .getByRole("button", { name: /Сатурн/ })
    .click();
  await stage(6, "full");
  await p.getByRole("button", { name: "Источники и управление" }).click();
  await p.getByRole("button", { name: "Закрыть справку" }).click();
  await p.getByRole("button", { name: "Общий вид системы" }).click();
  await idle();
  assert.equal((await snap()).target.kind, "system");
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(
    "test-results/interactive/interaction-report.json",
    JSON.stringify({ result: "PASS", errors }, null, 2),
  );
  console.log("All interaction checks passed.");
} finally {
  await b.close();
}
