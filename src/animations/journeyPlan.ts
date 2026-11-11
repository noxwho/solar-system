import * as THREE from "three";
import { planets, positionOf } from "../data/planets";
import type { Pose } from "./journeyTypes";
import { cameraViews } from "./cameraViews";
const up = new THREE.Vector3(0, 1, 0);
const centerOf = (index: number) =>
  new THREE.Vector3(...positionOf(planets[index]));
export function systemPose(mobile: boolean): Pose {
  return {
    position: new THREE.Vector3(
      mobile ? 14 : 12,
      mobile ? 99 : 49,
      mobile ? 141 : 88,
    ),
    target: new THREE.Vector3(),
  };
}
export function initialPose(): Pose {
  return { position: new THREE.Vector3(0, 3, 21), target: new THREE.Vector3() };
}
export function planetPose(
  index: number,
  scale: "full" | "close" | "drift" | "departure",
  mobile: boolean,
  short: boolean,
  _reduced = false,
): Pose {
  const p = planets[index],
    config = cameraViews[index],
    center = centerOf(index);
  // Reduced motion changes timing, never the selected physical camera view.
  const isClose = scale === "close",
    style = isClose ? config.close : config.full;
  const yaw =
    style.yaw +
    (mobile && index === 1 && !isClose ? 0.4 : 0) +
    (scale === "drift" ? 0.035 : 0);
  const direction =
    index === 0
      ? new THREE.Vector3(0, 0, 1)
      : center.clone().negate().normalize();
  direction.applyAxisAngle(up, yaw);
  direction.y = style.elevation;
  direction.normalize();
  let distance =
    p.radius *
    (isClose && mobile
      ? (config.close.mobileDistance ?? style.distance)
      : style.distance);
  if (mobile && !isClose) distance *= index === 6 ? 2.05 : short ? 1.95 : 1.8;
  distance = Math.max(distance, p.radius * (1 + config.surfaceClearance));
  if (scale === "departure") distance = Math.max(distance * 2, p.radius * 9);
  const position = center.clone().addScaledVector(direction, distance);
  if (scale === "departure")
    position.y = Math.max(7, position.y + p.radius * 1.5);
  while (clearance(position) < 0.08) position.y += 0.5;
  const right = new THREE.Vector3().crossVectors(up, direction).normalize();
  const target = center
    .clone()
    .addScaledVector(right, mobile ? 0 : p.radius * style.offset);
  if (mobile)
    target.y -=
      p.radius *
      (isClose
        ? short
          ? config.close.shortOffset
          : config.close.mobileOffset
        : index === 6
          ? 1.6
          : short
            ? 1.2
            : 1);
  return { position, target };
}
export function obstacleRadius(index: number) {
  return (
    planets[index].radius * (index === 6 ? 2.4 : index === 0 ? 1.18 : 1.07)
  );
}
export function clearance(position: THREE.Vector3) {
  return Math.min(
    ...planets.map(
      (_, i) => position.distanceTo(centerOf(i)) - obstacleRadius(i),
    ),
  );
}
function curve(points: THREE.Vector3[]) {
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}
function directCurve(from: THREE.Vector3, to: THREE.Vector3) {
  return curve([
    from.clone(),
    from.clone().lerp(to, 0.33),
    from.clone().lerp(to, 0.67),
    to.clone(),
  ]);
}
export function pathClear(path: THREE.Curve<THREE.Vector3>) {
  for (let i = 0; i <= 320; i++) {
    if (clearance(path.getPoint(i / 320)) < 0.015) return false;
  }
  return true;
}
// Escape and arrival corridors stay outside the spheres and the entire ring envelope.
// Check the actual spline, lifting the transit corridor if it approaches an obstacle.
export function flightCurve(
  from: THREE.Vector3,
  to: THREE.Vector3,
): THREE.CatmullRomCurve3 {
  if (from.distanceTo(to) < 0.00001) return directCurve(from, to);
  const direct = directCurve(from, to);
  if (from.distanceTo(to) < 12 && pathClear(direct)) return direct;
  for (let attempt = 0; attempt < 10; attempt++) {
    const altitude = Math.max(from.y, to.y, 12) + 6 + attempt * 8;
    const p = curve([
      from.clone(),
      new THREE.Vector3(from.x, Math.max(from.y + 2, altitude * 0.65), from.z),
      new THREE.Vector3(from.x, altitude, from.z),
      new THREE.Vector3((from.x + to.x) / 2, altitude + 4, (from.z + to.z) / 2),
      new THREE.Vector3(to.x, altitude, to.z),
      new THREE.Vector3(to.x, Math.max(to.y + 2, altitude * 0.65), to.z),
      to.clone(),
    ]);
    if (pathClear(p)) return p;
  }
  throw new Error(
    `Unable to construct a safe flight corridor: ${from.toArray()} -> ${to.toArray()} (clearance ${clearance(from)}, ${clearance(to)})`,
  );
}
