import * as THREE from "three";
import type { JourneyRuntime } from "./journeyTypes";
export function createCinematicRuntime(): JourneyRuntime {
  return {
    canSelect: false,
    stars: 0,
    sun: 0,
    worlds: 0,
    orbits: 0,
    overview: true,
    running: false,
    rotationTime: 0,
    position: new THREE.Vector3(0, 5, 27),
    target: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    phase: "opening",
    index: 0,
  };
}
