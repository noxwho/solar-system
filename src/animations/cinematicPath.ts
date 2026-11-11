import * as THREE from "three";
import { planets, positionOf } from "../data/planets";
import {
  clearance,
  pathClear,
  planetPose,
  obstacleRadius,
  systemPose,
} from "./journeyPlan";
import { CAMERA_FOV, cameraViews } from "./cameraViews";
import type { Pose } from "./journeyTypes";
import type { Stage } from "./navigation";
export interface CameraLayout {
  width: number;
  height: number;
  reduced: boolean;
}
export interface FlightLeg {
  kind: "withdrawal" | "transit" | "approach" | "close" | "overview";
  duration: number;
  start: number;
  path: THREE.Curve<THREE.Vector3>;
  arcLength: boolean;
  followTarget: boolean;
  slopeA: number;
  slopeB: number;
}
export interface Flight {
  legs: FlightLeg[];
  duration: number;
  target: Stage;
  end: Pose;
  startTarget: THREE.Vector3;
  focusDuration: number;
  rotationCorrection: THREE.Quaternion;
  startRotation: THREE.Quaternion;
  arrivalRotation: THREE.Quaternion;
  startFocusDistance: number;
}
const up = new THREE.Vector3(0, 1, 0);
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lookQuaternion = (pose: Pose) =>
  new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(pose.position, pose.target, up),
  );
export const isPortrait = (layout: CameraLayout) =>
  layout.width < 760 || layout.width / layout.height < 1.1;
export function overviewPose(layout: CameraLayout): Pose {
  const pose = systemPose(isPortrait(layout));
  const needed =
    42 /
    (Math.tan((CAMERA_FOV * Math.PI) / 360) *
      (layout.width / layout.height) *
      0.83);
  pose.position.multiplyScalar(Math.max(1, needed / pose.position.length()));
  return pose;
}
export function stagePose(stage: Stage, layout: CameraLayout): Pose {
  return stage.kind === "system"
    ? overviewPose(layout)
    : planetPose(
        stage.index,
        stage.level,
        isPortrait(layout),
        layout.height < 760,
        layout.reduced,
      );
}
function logarithmicPath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  index: number,
) {
  const center = new THREE.Vector3(...positionOf(planets[index]));
  const a = from.clone().sub(center),
    b = to.clone().sub(center);
  const turn = new THREE.Quaternion().setFromUnitVectors(
    a.clone().normalize(),
    b.clone().normalize(),
  );
  return new THREE.CatmullRomCurve3(
    Array.from({ length: 61 }, (_, i) => {
      const u = i / 60;
      return a
        .clone()
        .normalize()
        .applyQuaternion(new THREE.Quaternion().slerp(turn, u))
        .multiplyScalar(
          Math.exp(
            THREE.MathUtils.lerp(Math.log(a.length()), Math.log(b.length()), u),
          ),
        )
        .add(center);
    }),
    false,
    "centripetal",
  );
}
/** A single broad arc with fixed end tangents. Interior clearance adjustments
 * cannot change its direction at the adjoining withdrawal/approach. */
class TravelArc extends THREE.Curve<THREE.Vector3> {
  constructor(readonly points: THREE.Vector3[]) {
    super();
    this.arcLengthDivisions = 600;
  }
  getPoint(t: number, out = new THREE.Vector3()) {
    const b = [1, 5, 10, 10, 5, 1];
    out.set(0, 0, 0);
    this.points.forEach((p, i) =>
      out.addScaledVector(p, b[i] * (1 - t) ** (5 - i) * t ** i),
    );
    return out;
  }
}
function point(path: THREE.Curve<THREE.Vector3>, arc: boolean, u: number) {
  return arc ? path.getPointAt(u) : path.getPoint(u);
}
function tangent(path: THREE.Curve<THREE.Vector3>, arc: boolean, end: boolean) {
  return point(path, arc, end ? 1 : 0.0001)
    .sub(point(path, arc, end ? 0.9999 : 0))
    .normalize();
}
function connectingArc(
  from: THREE.Vector3,
  to: THREE.Vector3,
  startDirection?: THREE.Vector3,
  endDirection?: THREE.Vector3,
) {
  const delta = to.clone().sub(from),
    distance = delta.length();
  const direction = delta.clone().normalize();
  const a = startDirection ?? direction,
    b = endDirection ?? direction;
  const side = new THREE.Vector3().crossVectors(direction, up).normalize();
  // Prefer the least deviation. Lift only when a sampled arc meets an obstacle;
  // there is no fixed flight altitude or vertical elevator segment.
  for (const handleFactor of [0.23, 0.12, 0.06, 0.025]) {
    const handle = distance * handleFactor;
    for (const lift of [0, 0.06, 0.12, 0.22, 0.38, 0.6, 1]) {
      for (const lateral of [0, 0.14, -0.14, 0.3, -0.3]) {
        const offset = up
          .clone()
          .multiplyScalar(distance * lift)
          .addScaledVector(side, distance * lateral);
        const curve = new TravelArc([
          from.clone(),
          from.clone().addScaledVector(a, handle * 0.5),
          from.clone().addScaledVector(a, handle).add(offset),
          to.clone().addScaledVector(b, -handle).add(offset),
          to.clone().addScaledVector(b, -handle * 0.5),
          to.clone(),
        ]);
        if (pathClear(curve)) return curve;
      }
    }
  }
  throw new Error("No clear continuous camera arc");
}
function parameterSlope(leg: FlightLeg, end: boolean, speed: number) {
  const a = point(leg.path, leg.arcLength, end ? 1 : 0.0001);
  const b = point(leg.path, leg.arcLength, end ? 0.9999 : 0);
  const derivative = a.distanceTo(b) / 0.0001;
  return (speed * leg.duration) / Math.max(derivative, 0.000001);
}
export function buildFlight(
  from: Pose,
  target: Stage,
  layout: CameraLayout,
): Flight {
  const legs: FlightLeg[] = [];
  const end = stagePose(target, layout);
  let duration = 0;
  const add = (
    kind: FlightLeg["kind"],
    path: THREE.Curve<THREE.Vector3>,
    seconds: number,
    arcLength: boolean,
  ) => {
    legs.push({
      kind,
      path,
      duration: seconds,
      start: duration,
      arcLength,
      followTarget: !arcLength,
      slopeA: 0,
      slopeB: 0,
    });
    duration += seconds;
  };
  if (target.kind === "system") {
    add(
      "overview",
      connectingArc(from.position, end.position),
      layout.reduced ? 2.4 : 4.8,
      true,
    );
  } else {
    const index = target.index,
      p = planets[index],
      config = cameraViews[index];
    const center = new THREE.Vector3(...positionOf(p));
    const d = from.position.distanceTo(center),
      endDistance = end.position.distanceTo(center);
    const facing = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(from.quaternion ?? lookQuaternion(from))
      .dot(center.clone().sub(from.position).normalize());
    if (
      d < Math.max(p.radius * 18, endDistance * 1.5) &&
      from.target.distanceTo(center) < p.radius * 4 &&
      facing > 0.35
    ) {
      const path = logarithmicPath(from.position, end.position, index);
      add(
        target.level === "close" ? "close" : "approach",
        pathClear(path) ? path : connectingArc(from.position, end.position),
        layout.reduced ? 1.8 : config.duration,
        !pathClear(path),
      );
    } else {
      let previous = from.position.clone();
      let departure: THREE.Curve<THREE.Vector3> | undefined;
      let origin = -1,
        nearest = Infinity;
      planets.forEach((body, i) => {
        const normalized =
          from.position.distanceTo(new THREE.Vector3(...positionOf(body))) /
          body.radius;
        if (i !== index && normalized < 15 && normalized < nearest) {
          nearest = normalized;
          origin = i;
        }
      });
      if (origin >= 0) {
        const body = planets[origin],
          c = new THREE.Vector3(...positionOf(body));
        const away = previous.clone().sub(c).normalize();
        const withdrawal = c
          .clone()
          .addScaledVector(
            away,
            Math.max(previous.distanceTo(c) * 1.35, body.radius * 6),
          );
        const candidate = logarithmicPath(previous, withdrawal, origin);
        if (pathClear(candidate)) {
          departure = candidate;
          add("withdrawal", candidate, layout.reduced ? 0.6 : 0.95, false);
          previous = withdrawal;
        }
      }
      const distance = Math.max(endDistance * 2.65, p.radius * 12);
      let approach: THREE.CatmullRomCurve3 | undefined;
      for (let attempt = 0; attempt < 24; attempt++) {
        const dir = end.position
          .clone()
          .sub(center)
          .normalize()
          .applyAxisAngle(
            up,
            config.arc +
              (attempt % 2 ? -1 : 1) * Math.floor(attempt / 2) * 0.05,
          );
        if (attempt > 5) dir.y += (attempt - 5) * 0.12;
        const entry = center.clone().addScaledVector(dir.normalize(), distance);
        const path = logarithmicPath(entry, end.position, index);
        if (clearance(entry) > 0.08 && pathClear(path)) {
          approach = path;
          break;
        }
      }
      if (!approach) throw new Error(`No safe optical approach for ${p.id}`);
      const entry = approach.getPoint(0);
      const transit = connectingArc(
        previous,
        entry,
        departure ? tangent(departure, false, true) : undefined,
        tangent(approach, false, false),
      );
      add(
        "transit",
        transit,
        previous.distanceTo(entry) > 65 ? 2.1 : 1.6,
        true,
      );
      add("approach", approach, layout.reduced ? 2.2 : 3.3, false);
    }
  }
  // Shared physical speeds at joins: no stop/start at the internal waypoints.
  for (let i = 0; i < legs.length - 1; i++) {
    const a = legs[i],
      b = legs[i + 1];
    let speed =
      Math.min(
        a.path.getLength() / a.duration,
        b.path.getLength() / b.duration,
      ) * 0.65;
    let sa = parameterSlope(a, true, speed),
      sb = parameterSlope(b, false, speed);
    const limit = Math.min(1, 2.5 / Math.max(sa, sb));
    speed *= limit;
    sa = parameterSlope(a, true, speed);
    sb = parameterSlope(b, false, speed);
    a.slopeB = sa;
    b.slopeA = sb;
  }
  const focusDuration = legs.length > 1 ? legs.at(-1)!.start : duration;
  return {
    legs,
    duration,
    target,
    end,
    startTarget: from.target.clone(),
    focusDuration,
    rotationCorrection: lookQuaternion(from)
      .invert()
      .multiply(from.quaternion ?? lookQuaternion(from)),
    startRotation: from.quaternion?.clone() ?? lookQuaternion(from),
    arrivalRotation: lookQuaternion({
      position: legs.at(-1)!.path.getPoint(0),
      target: end.target,
    }),
    startFocusDistance: from.position.distanceTo(from.target),
  };
}
export function sampleFlight(
  flight: Flight,
  time: number,
  position: THREE.Vector3,
  target: THREE.Vector3,
  quaternion: THREE.Quaternion,
) {
  const leg =
    flight.legs.find((l) => time < l.start + l.duration - 1e-8) ??
    flight.legs.at(-1)!;
  const t = THREE.MathUtils.clamp((time - leg.start) / leg.duration, 0, 1);
  // Monotone cubic Hermite time map, with nonzero matching world speeds at joins.
  const u =
    flight.legs.length === 1
      ? smooth(t)
      : (t * t * t - 2 * t * t + t) * leg.slopeA +
        (-2 * t * t * t + 3 * t * t) +
        (t * t * t - t * t) * leg.slopeB;
  if (leg.arcLength) leg.path.getPointAt(u, position);
  else leg.path.getPoint(u, position);
  const focus = smooth(
    THREE.MathUtils.clamp(time / Math.max(flight.focusDuration, 0.001), 0, 1),
  );
  target.copy(flight.startTarget).lerp(flight.end.target, focus);
  if (flight.legs.length > 1 || flight.target.kind === "system") {
    // A moving lookAt point can pass beneath the lens and cause a fast yaw flip.
    // Turn in quaternion space during transit, then smoothly acquire the actual
    // destination only in the clear arrival corridor.
    const overview = flight.target.kind === "system";
    quaternion
      .copy(flight.startRotation)
      .slerp(
        overview ? lookQuaternion(flight.end) : flight.arrivalRotation,
        focus,
      );
    const acquire = overview
      ? 0
      : smooth(
          THREE.MathUtils.clamp(
            (time - flight.focusDuration + 0.4) / 0.8,
            0,
            1,
          ),
        );
    if (acquire > 0) {
      const tracking = lookQuaternion({ position, target: flight.end.target });
      quaternion.slerp(tracking, acquire);
    }
    const distance = THREE.MathUtils.lerp(
      flight.startFocusDistance,
      position.distanceTo(flight.end.target),
      focus,
    );
    target
      .set(0, 0, -1)
      .applyQuaternion(quaternion)
      .multiplyScalar(distance)
      .add(position);
    return leg;
  }
  quaternion.setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, up),
  );
  quaternion.multiply(
    flight.rotationCorrection.clone().slerp(new THREE.Quaternion(), focus),
  );
  return leg;
}
export function projectedDiameter(stage: Stage, position: THREE.Vector3) {
  if (stage.kind === "system") return 0;
  const p = planets[stage.index],
    d = position.distanceTo(new THREE.Vector3(...positionOf(p)));
  return (
    p.radius /
    (Math.max(d, obstacleRadius(stage.index)) *
      Math.tan((CAMERA_FOV * Math.PI) / 360))
  );
}
