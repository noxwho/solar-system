import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import {
  buildFlight,
  overviewPose,
  sampleFlight,
  projectedDiameter,
  type Flight,
} from "./cinematicPath";
import { clearance, flightCurve } from "./journeyPlan";
import { planets, positionOf } from "../data/planets";
import type { CameraControllerProps } from "./cinematicTypes";
export default function CinematicCameraController(
  props: CameraControllerProps,
) {
  const { camera, size, gl } = useThree(),
    latest = useRef(props);
  latest.current = props;
  const timeline = useRef<gsap.core.Timeline | null>(null),
    introDone = useRef(false),
    flightRef = useRef<Flight | null>(null);
  const legRef = useRef("opening"),
    handoff = useRef({ position: 0, angle: 0 }),
    elapsed = useRef(0);
  const ui = useRef({
    overview: 0,
    copy: 0,
    reveals: Array.from({ length: 4 }, () => ({ value: 0 })),
  });
  const runtime = props.runtime;
  const renderUI = () => {
    const { infoRef, overviewRef } = latest.current;
    if (infoRef.current) {
      infoRef.current.style.opacity = String(ui.current.copy);
      infoRef.current.style.pointerEvents =
        ui.current.copy > 0.9 ? "auto" : "none";
      infoRef.current
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((e, i) => {
          const v = ui.current.reveals[i]?.value ?? 0;
          e.style.opacity = String(v);
          e.style.transform = `translate3d(0,${(1 - v) * 14}px,0)`;
          e.style.filter = `blur(${(1 - v) * 4}px)`;
        });
    }
    if (overviewRef.current) {
      overviewRef.current.style.opacity = String(ui.current.overview);
      overviewRef.current.style.visibility =
        ui.current.overview > 0.001 ? "visible" : "hidden";
    }
  };
  useEffect(() => {
    if (!props.ready) return;
    timeline.current?.kill();
    const layout = {
      width: size.width,
      height: size.height,
      reduced: props.reduced,
    };
    const before = camera.position.clone(),
      beforeQ = camera.quaternion.clone();
    runtime.position.copy(camera.position);
    runtime.quaternion.copy(camera.quaternion);
    const master = gsap.timeline({ paused: true, onUpdate: renderUI });
    timeline.current = master;
    if (!introDone.current && !props.command) {
      const end = overviewPose(layout),
        path = flightCurve(camera.position, end.position),
        startQ = camera.quaternion.clone();
      const endQ = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(
          end.position,
          end.target,
          new THREE.Vector3(0, 1, 0),
        ),
      );
      const cursor = { t: 0 };
      master
        .to(runtime, { stars: 1, duration: 1.8 }, 0)
        .to(runtime, { sun: 1, duration: 2.4 }, 1)
        .to(runtime, { worlds: 1, orbits: 0.13, duration: 2.5 }, 2.6);
      master.to(
        cursor,
        {
          t: 1,
          duration: props.reduced ? 1.3 : 6.2,
          ease: "sine.inOut",
          onUpdate: () => {
            path.getPointAt(cursor.t, runtime.position);
            runtime.quaternion.copy(startQ).slerp(endQ, cursor.t);
            runtime.target.copy(end.target);
            camera.position.copy(runtime.position);
            camera.quaternion.copy(runtime.quaternion);
          },
        },
        0,
      );
      master.to(
        ui.current,
        { overview: 1, duration: 1.2 },
        props.reduced ? 0.2 : 4.8,
      );
      master.call(() => {
        introDone.current = true;
        runtime.phase = "system";
        runtime.overview = true;
        runtime.canSelect = true;
        latest.current.onIntro();
        latest.current.onArrive({ kind: "system" });
      });
      master.play();
      return () => {
        master.kill();
      };
    }
    introDone.current = true;
    const stage = props.command?.stage ?? { kind: "system" as const };
    const flight = buildFlight(
      {
        position: camera.position,
        target: runtime.target,
        quaternion: camera.quaternion,
      },
      stage,
      layout,
    );
    flightRef.current = flight;
    const clock = { time: 0 };
    elapsed.current = 0;
    runtime.running = true;
    runtime.canSelect = false;
    latest.current.onMoving(true);
    const sample = () => {
      elapsed.current = clock.time;
      const leg = sampleFlight(
        flight,
        clock.time,
        runtime.position,
        runtime.target,
        runtime.quaternion,
      );
      legRef.current = leg.kind;
      camera.position.copy(runtime.position);
      camera.quaternion.copy(runtime.quaternion);
    };
    sample();
    handoff.current = {
      position: camera.position.distanceTo(before),
      angle: camera.quaternion.angleTo(beforeQ),
    };
    master.to(
      ui.current,
      { copy: 0, overview: 0, duration: 0.35, ease: "power2.out" },
      0,
    );
    master.to(
      clock,
      {
        time: flight.duration,
        duration: flight.duration,
        ease: "none",
        onUpdate: sample,
      },
      0,
    );
    master.to(
      runtime,
      { orbits: stage.kind === "system" ? 0.13 : 0, duration: 1.1 },
      0,
    );
    master.call(
      () => {
        runtime.running = false;
        runtime.overview = stage.kind === "system";
        runtime.canSelect = stage.kind === "system";
        runtime.phase =
          stage.kind === "system"
            ? "system"
            : stage.level === "full"
              ? "reveal"
              : "close";
        runtime.index = stage.kind === "system" ? 0 : stage.index;
        if (stage.kind === "system") latest.current.onArrive(stage);
        latest.current.onMoving(false);
      },
      [],
      flight.duration,
    );
    if (stage.kind === "system") {
      master.to(
        ui.current,
        { overview: 1, duration: 0.9 },
        flight.duration - 0.25,
      );
    } else {
      const reveal = Math.max(0.4, flight.duration - 0.6);
      master.call(() => latest.current.onArrive(stage), [], reveal);
      master.set(ui.current.reveals, { value: 0 }, reveal);
      master.to(ui.current, { copy: 1, duration: 0.1 }, reveal + 0.04);
      master.to(
        ui.current.reveals,
        { value: 1, duration: 0.55, stagger: 0.08, ease: "power2.out" },
        reveal + 0.08,
      );
    }
    master.play();
    return () => {
      master.kill();
      runtime.running = false;
    };
  }, [
    props.ready,
    props.command,
    size.width,
    size.height,
    props.reduced,
    camera,
    runtime,
  ]);
  useFrame((_, delta) => {
    if (!latest.current.reduced) runtime.rotationTime += Math.min(delta, 0.05);
    renderUI();
  });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const scope = window as unknown as Record<string, unknown>;
    scope.__planetCamera = {
      snapshot: () => {
        const flight = flightRef.current;
        const bodyPositions = planets.map((p) => {
          const v = new THREE.Vector3(...positionOf(p)).project(camera);
          return {
            id: p.id,
            x: (v.x * 0.5 + 0.5) * size.width,
            y: (-v.y * 0.5 + 0.5) * size.height,
            z: v.z,
          };
        });
        return {
          position: camera.position.toArray(),
          quaternion: camera.quaternion.toArray(),
          cameraId: camera.uuid,
          rotation: runtime.rotationTime,
          introDone: introDone.current,
          moving: runtime.running,
          leg: legRef.current,
          time: elapsed.current,
          duration: flight?.duration ?? 6.2,
          target: flight?.target ?? { kind: "system" },
          size: flight ? projectedDiameter(flight.target, camera.position) : 0,
          clearance: clearance(camera.position),
          handoff: handoff.current,
          opacity: planets.map((_, i) =>
            i === 0 ? runtime.sun : runtime.worlds,
          ),
          screen: bodyPositions,
          settled: !timeline.current?.isActive(),
        };
      },
      bounds: (index: number) => {
        const body = planets[index],
          center = new THREE.Vector3(...positionOf(body)),
          points: THREE.Vector3[] = [];
        for (let a = 0; a <= 18; a++)
          for (let b = 0; b < 36; b++)
            points.push(
              new THREE.Vector3(
                Math.sin((a / 18) * Math.PI) * Math.cos((b / 36) * Math.PI * 2),
                Math.cos((a / 18) * Math.PI),
                Math.sin((a / 18) * Math.PI) * Math.sin((b / 36) * Math.PI * 2),
              )
                .multiplyScalar(body.radius)
                .add(center),
            );
        if (index === 6)
          for (let i = 0; i < 128; i++)
            points.push(
              new THREE.Vector3(
                Math.cos((i / 128) * Math.PI * 2) * body.radius * 2.28,
                0,
                Math.sin((i / 128) * Math.PI * 2) * body.radius * 2.28,
              )
                .applyAxisAngle(
                  new THREE.Vector3(0, 0, 1),
                  (body.tilt * Math.PI) / 180,
                )
                .add(center),
            );
        const projected = points.map((p) => p.project(camera));
        return {
          xMin: Math.min(
            ...projected.map((p) => (p.x * 0.5 + 0.5) * size.width),
          ),
          xMax: Math.max(
            ...projected.map((p) => (p.x * 0.5 + 0.5) * size.width),
          ),
          yMin: Math.min(
            ...projected.map((p) => (-p.y * 0.5 + 0.5) * size.height),
          ),
          yMax: Math.max(
            ...projected.map((p) => (-p.y * 0.5 + 0.5) * size.height),
          ),
        };
      },
    };
    return () => {
      delete scope.__planetCamera;
    };
  }, [camera, gl, runtime, size.width, size.height]);
  return null;
}
