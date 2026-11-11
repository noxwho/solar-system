import type { Vector3, Quaternion } from "three";
export interface Pose {
  position: Vector3;
  target: Vector3;
  quaternion?: Quaternion;
}
export interface JourneyRuntime {
  canSelect: boolean;
  stars: number;
  sun: number;
  worlds: number;
  orbits: number;
  overview: boolean;
  running: boolean;
  rotationTime: number;
  position: Vector3;
  target: Vector3;
  quaternion: Quaternion;
  phase: "opening" | "system" | "reveal" | "close";
  index: number;
}
