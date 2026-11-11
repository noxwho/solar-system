/** Distances and offsets are in body radii. FOV is shared with the Canvas. */
export const CAMERA_FOV = 42;
export interface CameraViewConfig {
  full: { yaw: number; elevation: number; distance: number; offset: number };
  close: {
    yaw: number;
    elevation: number;
    distance: number;
    offset: number;
    copy: "left" | "right";
    mobileDistance?: number;
    mobileOffset: number;
    shortOffset: number;
  };
  duration: number;
  easing: "smootherstep";
  surfaceClearance: number;
  arc: number;
}
export const cameraViews: CameraViewConfig[] = [
  {
    full: { yaw: Math.PI + 0.3, elevation: 0.2, distance: 4.4, offset: 0.92 },
    close: {
      yaw: Math.PI + 0.4,
      elevation: 0.24,
      distance: 2,
      offset: 1.05,
      copy: "right",
      mobileOffset: 1.43,
      shortOffset: 1.53,
    },
    duration: 3.6,
    easing: "smootherstep",
    surfaceClearance: 0.18,
    arc: 0.08,
  },
  {
    full: { yaw: 0.5, elevation: 0.22, distance: 4.3, offset: 0.92 },
    close: {
      yaw: 0.64,
      elevation: 0.24,
      distance: 1.95,
      offset: 1.02,
      copy: "right",
      mobileOffset: 1.43,
      shortOffset: 1.53,
    },
    duration: 3.5,
    easing: "smootherstep",
    surfaceClearance: 0.1,
    arc: -0.08,
  },
  {
    full: { yaw: 0.83, elevation: 0.28, distance: 4.3, offset: 0.92 },
    close: {
      yaw: 0.98,
      elevation: 0.34,
      distance: 1.65,
      offset: -1.45,
      copy: "left",
      mobileOffset: 1.6,
      shortOffset: 1.7,
    },
    duration: 3.8,
    easing: "smootherstep",
    surfaceClearance: 0.14,
    arc: 0.1,
  },
  {
    full: { yaw: 0.88, elevation: 0.22, distance: 4.3, offset: 0.92 },
    close: {
      yaw: 1.08,
      elevation: 0.17,
      distance: 1.95,
      offset: 1.05,
      copy: "right",
      mobileOffset: 1.43,
      shortOffset: 1.53,
    },
    duration: 3.7,
    easing: "smootherstep",
    surfaceClearance: 0.14,
    arc: -0.06,
  },
  {
    full: { yaw: 0.67, elevation: 0.18, distance: 4.3, offset: 0.92 },
    close: {
      yaw: 0.83,
      elevation: 0.3,
      distance: 1.65,
      offset: -1.5,
      copy: "left",
      mobileOffset: 1.6,
      shortOffset: 1.7,
    },
    duration: 3.8,
    easing: "smootherstep",
    surfaceClearance: 0.1,
    arc: 0.07,
  },
  {
    full: { yaw: 0.83, elevation: 0.12, distance: 4.5, offset: 0.92 },
    close: {
      yaw: 1.03,
      elevation: 0.1,
      distance: 1.95,
      offset: 1.05,
      copy: "right",
      mobileOffset: 1.43,
      shortOffset: 1.53,
    },
    duration: 3.6,
    easing: "smootherstep",
    surfaceClearance: 0.12,
    arc: -0.07,
  },
  {
    full: { yaw: 0.55, elevation: 0.72, distance: 6.4, offset: 0.92 },
    close: {
      yaw: 0.84,
      elevation: 0.63,
      distance: 3.6,
      offset: 1.15,
      copy: "right",
      mobileDistance: 5.8,
      mobileOffset: 3,
      shortOffset: 3.2,
    },
    duration: 3.9,
    easing: "smootherstep",
    surfaceClearance: 1.4,
    arc: 0.08,
  },
  {
    full: { yaw: 0.65, elevation: 0.35, distance: 4.3, offset: 0.92 },
    close: {
      yaw: 0.84,
      elevation: 0.28,
      distance: 1.95,
      offset: 1.05,
      copy: "right",
      mobileOffset: 1.43,
      shortOffset: 1.53,
    },
    duration: 3.6,
    easing: "smootherstep",
    surfaceClearance: 0.14,
    arc: -0.09,
  },
  {
    full: { yaw: 0.94, elevation: 0.2, distance: 4.3, offset: 0.92 },
    close: {
      yaw: 1.11,
      elevation: 0.26,
      distance: 1.65,
      offset: -1.5,
      copy: "left",
      mobileOffset: 1.6,
      shortOffset: 1.7,
    },
    duration: 3.8,
    easing: "smootherstep",
    surfaceClearance: 0.14,
    arc: 0.08,
  },
];
