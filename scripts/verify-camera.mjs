import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import * as T from "three";
import assert from "node:assert/strict";
await mkdir(".tools", { recursive: true });
await mkdir("test-results/interactive", { recursive: true });
for (const [name, file] of [
  ["path", "cinematicPath"],
  ["geometry", "journeyPlan"],
  ["nav", "navigation"],
])
  await build({
    entryPoints: [`src/animations/${file}.ts`],
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    outfile: `.tools/test-${name}.mjs`,
  });
const {
  buildFlight,
  overviewPose,
  sampleFlight,
  stagePose,
  projectedDiameter,
} = await import(pathToFileURL(resolve(".tools/test-path.mjs")));
const { clearance } = await import(
  pathToFileURL(resolve(".tools/test-geometry.mjs"))
);
const { moveNavigation, pushStage, systemStage } = await import(
  pathToFileURL(resolve(".tools/test-nav.mjs"))
);
let min = Infinity,
  count = 0,
  maxJoin = 0,
  maxAngle = 0,
  maxTurnRate = 0,
  maxJoinDirection = 0,
  maxJoinSpeed = 0,
  plans = 0;
const p = new T.Vector3(),
  target = new T.Vector3(),
  q = new T.Quaternion();
function verify(flight, from) {
  plans++;
  sampleFlight(flight, 0, p, target, q);
  maxJoin = Math.max(maxJoin, p.distanceTo(from.position));
  assert.ok(p.distanceTo(from.position) < 1e-8);
  if (from.quaternion) {
    maxAngle = Math.max(maxAngle, q.angleTo(from.quaternion));
    assert.ok(q.angleTo(from.quaternion) < 1e-6);
  }
  for (let n = 0; n <= 500; n++) {
    const beforeRotation = q.clone();
    sampleFlight(flight, (flight.duration * n) / 500, p, target, q);
    const c = clearance(p);
    min = Math.min(min, c);
    assert.ok(c > 0, "camera entered geometry/rings");
    assert.ok(Math.abs(q.length() - 1) < 1e-8);
    if (n > 0)
      maxTurnRate = Math.max(
        maxTurnRate,
        beforeRotation.angleTo(q) / (flight.duration / 500),
      );
    count++;
  }
  for (let i = 1; i < flight.legs.length; i++) {
    const boundary = flight.legs[i].start,
      dt = 0.0001;
    sampleFlight(flight, boundary - dt, p, target, q);
    const left = p.clone();
    sampleFlight(flight, boundary, p, target, q);
    const middle = p.clone();
    sampleFlight(flight, boundary + dt, p, target, q);
    const a = middle.clone().sub(left).divideScalar(dt),
      b = p.clone().sub(middle).divideScalar(dt);
    const angle = a.angleTo(b),
      speedError =
        Math.abs(a.length() - b.length()) / Math.max(a.length(), b.length());
    maxJoinDirection = Math.max(maxJoinDirection, angle);
    maxJoinSpeed = Math.max(maxJoinSpeed, speedError);
    assert.ok(
      angle < 0.025 && speedError < 0.04,
      "discontinuous direction or velocity at route join",
    );
  }
  for (const leg of flight.legs.filter(
    (l) => l.kind === "approach" && l.followTarget,
  )) {
    let last;
    sampleFlight(flight, leg.start, p, target, q);
    const firstSize = projectedDiameter(flight.target, p);
    sampleFlight(flight, leg.start + leg.duration, p, target, q);
    const sign = projectedDiameter(flight.target, p) >= firstSize ? 1 : -1;
    for (let n = 0; n <= 100; n++) {
      sampleFlight(flight, leg.start + (leg.duration * n) / 100, p, target, q);
      const size = projectedDiameter(flight.target, p);
      if (last !== undefined) assert.ok((size - last) * sign >= -1e-6);
      last = size;
    }
  }
  sampleFlight(flight, flight.duration, p, target, q);
  return { position: p.clone(), target: target.clone(), quaternion: q.clone() };
}
for (const layout of [
  { width: 1440, height: 1000, reduced: false },
  { width: 390, height: 844, reduced: false },
  { width: 375, height: 667, reduced: false },
  { width: 768, height: 1024, reduced: false },
  { width: 390, height: 844, reduced: true },
  { width: 1440, height: 1000, reduced: true },
]) {
  let prev = overviewPose(layout);
  for (let i = 0; i < 9; i++)
    for (const level of ["full", "close"]) {
      const f = buildFlight(prev, { kind: "planet", index: i, level }, layout);
      assert.ok(f.duration <= 7);
      prev = verify(f, prev);
      if (level === "close") {
        const full = stagePose(
          { kind: "planet", index: i, level: "full" },
          layout,
        );
        assert.ok(
          projectedDiameter(f.target, prev.position) /
            projectedDiameter(f.target, full.position) >
            1.6,
          "close-up must physically grow, including reduced motion",
        );
        const reverse = buildFlight(
          prev,
          { kind: "planet", index: i, level: "full" },
          layout,
        );
        const returned = verify(reverse, prev);
        assert.ok(
          returned.position.distanceTo(full.position) < 1e-7,
          "reverse must return to the full pose",
        );
      }
    }
  for (let i = 0; i < 9; i++) {
    const from = overviewPose(layout);
    verify(
      buildFlight(from, { kind: "planet", index: i, level: "full" }, layout),
      from,
    );
  }
}
const layout = { width: 1440, height: 1000, reduced: false };
for (let a = 0; a < 9; a++)
  for (let b = 0; b < 9; b++) {
    const from = stagePose(
      { kind: "planet", index: a, level: "close" },
      layout,
    );
    verify(
      buildFlight(from, { kind: "planet", index: b, level: "full" }, layout),
      from,
    );
  }
for (let i = 0; i < 9; i++) {
  const f = buildFlight(
    overviewPose(layout),
    { kind: "planet", index: i, level: "full" },
    layout,
  );
  sampleFlight(f, f.duration * 0.57, p, target, q);
  const from = {
    position: p.clone(),
    target: target.clone(),
    quaternion: q.clone(),
  };
  verify(
    buildFlight(
      from,
      { kind: "planet", index: (i + 4) % 9, level: "full" },
      layout,
    ),
    from,
  );
}
let nav = { entries: [systemStage], cursor: 0 };
nav = pushStage(nav, { kind: "planet", index: 3, level: "full" });
nav = moveNavigation(nav, 1);
assert.deepEqual(nav.entries[nav.cursor], {
  kind: "planet",
  index: 3,
  level: "close",
});
nav = moveNavigation(nav, 1);
assert.equal(nav.entries[nav.cursor].index, 4);
nav = moveNavigation(nav, -1);
assert.equal(nav.entries[nav.cursor].level, "close");
nav = moveNavigation(nav, -1);
nav = moveNavigation(nav, -1);
assert.equal(nav.entries[nav.cursor].kind, "system");
nav = moveNavigation(nav, 1);
assert.equal(nav.entries[nav.cursor].index, 3);
nav = pushStage(nav, { kind: "planet", index: 8, level: "full" });
assert.equal(nav.cursor, nav.entries.length - 1);
const report = {
  result: "PASS",
  plans,
  samples: count,
  minClearance: min,
  maxStartPositionError: maxJoin,
  maxStartQuaternionError: maxAngle,
  maxTurnRateRadiansPerSecond: maxTurnRate,
  maxJoinDirectionRadians: maxJoinDirection,
  maxJoinRelativeSpeedError: maxJoinSpeed,
  checks:
    "canonical route, actual full/close growth including reduced motion, reverse for all bodies/layouts, all interplanet pairs, interrupted quaternion, continuous join direction/speed, portrait layouts and history",
};
assert.ok(maxTurnRate < 6, "fast quaternion spin");
await writeFile(
  "test-results/interactive/geometry-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
