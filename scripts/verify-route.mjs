import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results/interactive", { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [],
  failed = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
p.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
});
const snap = () => p.evaluate(() => window.__planetCamera.snapshot());
const arrive = async (index, level) => {
  await p.waitForFunction(
    ({ index, level }) => {
      const s = window.__planetCamera.snapshot();
      return (
        s.target.kind === "planet" &&
        s.target.index === index &&
        s.target.level === level &&
        s.settled &&
        !s.moving
      );
    },
    { index, level },
    { timeout: 15000 },
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
  const initial = await snap();
  await p.waitForTimeout(1000);
  const held = await snap();
  assert.deepEqual(held.position, initial.position);
  assert.deepEqual(held.quaternion, initial.quaternion);
  assert.ok(held.rotation > initial.rotation);
  await p.screenshot({ path: "test-results/interactive/overview.png" });
  console.log(
    "PASS 6.2-second opening, idle system, independent slow rotation",
  );
  const canvas = await p.locator("canvas").elementHandle();
  await p.evaluate(() => {
    window.metrics = {
      frames: 0,
      minClearance: Infinity,
      maxHandoff: 0,
      growth: [],
    };
    function frame() {
      const m = window.metrics,
        s = window.__planetCamera?.snapshot();
      if (s) {
        m.frames++;
        m.minClearance = Math.min(m.minClearance, s.clearance);
        m.maxHandoff = Math.max(m.maxHandoff, s.handoff.position);
        if (
          s.target.kind === "planet" &&
          s.target.level === "full" &&
          s.leg === "approach" &&
          s.duration > 4 &&
          s.moving
        )
          m.growth.push({ index: s.target.index, time: s.time, size: s.size });
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  let full;
  for (let i = 0; i < 9; i++)
    for (const level of ["full", "close"]) {
      await p
        .getByRole("button", { name: "Следующий этап", exact: true })
        .click();
      await arrive(i, level);
      const s = await snap();
      if (level === "full") full = s;
      else {
        assert.ok(s.size / full.size > 1.6, `no physical close-up for ${i}`);
        const bounds = await p.evaluate(
          (i) => window.__planetCamera.bounds(i),
          i,
        );
        assert.ok(
          bounds.xMin < 0 ||
            bounds.xMax > 1440 ||
            bounds.yMin < 0 ||
            bounds.yMax > 1000,
          `close-up not cropped for ${i}`,
        );
      }
      assert.equal(s.cameraId, initial.cameraId);
      assert.ok(s.handoff.position < 1e-8 && s.handoff.angle < 1e-6);
      assert.ok(
        s.opacity.every((v) => v > 0.999),
        "object opacity switched with stage",
      );
      await p.screenshot({
        path: `test-results/interactive/${level}-${i}.png`,
      });
      console.log(`PASS ${i} ${level}`);
      if (level === "close") {
        await p
          .getByRole("button", { name: "Предыдущий этап", exact: true })
          .click();
        await arrive(i, "full");
        const returned = await snap();
        assert.ok(
          returned.position.every(
            (v, axis) => Math.abs(v - full.position[axis]) < 1e-7,
          ),
        );
        await p
          .getByRole("button", { name: "Следующий этап", exact: true })
          .click();
        await arrive(i, "close");
        console.log(`PASS ${i} reverse and repeat close-up`);
      }
    }
  assert.ok(
    await p
      .getByRole("button", { name: "Следующий этап", exact: true })
      .isDisabled(),
  );
  assert.ok(
    await canvas.evaluate((c) => c === document.querySelector("canvas")),
  );
  const metrics = await p.evaluate(() => window.metrics);
  assert.ok(metrics.minClearance > 0);
  assert.ok(metrics.maxHandoff < 1e-8);
  for (let i = 0; i < 9; i++) {
    const growth = metrics.growth.filter((s) => s.index === i);
    assert.ok(growth.length > 15);
    assert.ok(growth.at(-1).size > growth[0].size * 1.5);
    let drops = 0;
    for (let j = 1; j < growth.length; j++)
      if (growth[j].size < growth[j - 1].size - 1e-5) drops++;
    assert.equal(drops, 0, `non-monotonic optical approach ${i}`);
  }
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(failed.length, 0, failed.join("\n"));
  await writeFile(
    "test-results/interactive/route-report.json",
    JSON.stringify({ result: "PASS", ...metrics, errors, failed }, null, 2),
  );
  console.log(
    "PASS full route, no stage opacity toggles, gradual angular growth, one camera",
  );
} finally {
  await b.close();
}
