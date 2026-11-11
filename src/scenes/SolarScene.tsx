import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, Line, useProgress, useTexture } from "@react-three/drei";
import * as THREE from "three";
import Planet from "../planets/Planet";
import CinematicCameraController from "../animations/CinematicCameraController";
import type { JourneyRuntime } from "../animations/journeyTypes";
import type { CameraControllerProps } from "../animations/cinematicTypes";
import { planets } from "../data/planets";
import { preloadTextures } from "../planets/textureQuality";

preloadTextures.forEach((url) => useTexture.preload(url));
const orbitPaths = planets
  .slice(1)
  .map((p) =>
    Array.from(
      { length: 181 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 180) * Math.PI * 2) * p.orbit,
          0,
          Math.sin((i / 180) * Math.PI * 2) * p.orbit,
        ),
    ),
  );
function Orbits({ runtime }: { runtime: JourneyRuntime }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.visible = runtime.orbits > 0.001;
      ref.current.traverse((child) => {
        if (child instanceof THREE.Mesh)
          (child.material as THREE.Material).opacity = runtime.orbits;
      });
    }
  });
  return (
    <group ref={ref}>
      {orbitPaths.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#7187a4"
          transparent
          opacity={0}
          lineWidth={0.6}
        />
      ))}
    </group>
  );
}
function StarField({ runtime }: { runtime: JourneyRuntime }) {
  const group = useRef<THREE.Points>(null),
    material = useRef<THREE.ShaderMaterial>(null);
  const positions = useMemo(() => {
    let seed = 4281;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const result = new Float32Array(4200 * 3);
    for (let i = 0; i < 4200; i++) {
      const z = random() * 2 - 1,
        a = random() * Math.PI * 2,
        r = 350 + random() * 420,
        s = Math.sqrt(1 - z * z);
      result.set([Math.cos(a) * s * r, z * r, Math.sin(a) * s * r], i * 3);
    }
    return result;
  }, []);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 0 } }),
    [],
  );
  useFrame(() => {
    if (material.current) {
      material.current.uniforms.uTime.value = runtime.rotationTime;
      material.current.uniforms.uOpacity.value = runtime.stars;
    }
    if (group.current) group.current.rotation.y = runtime.rotationTime * 0.0003;
  });
  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`uniform float uTime;varying float vBrightness;void main(){float seed=fract(sin(dot(position.xy,vec2(12.9898,78.233)))*43758.5453);vBrightness=.2+seed*.65+.06*sin(uTime*.4+seed*50.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=.8+seed*1.65;}`}
        fragmentShader={`uniform float uOpacity;varying float vBrightness;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d);gl_FragColor=vec4(.78,.86,1.,a*vBrightness*uOpacity);}`}
      />
    </points>
  );
}
function Loading({ onReady }: { onReady: () => void }) {
  const { progress, active, errors } = useProgress();
  useEffect(() => {
    if (!active && progress === 100 && errors.length === 0) onReady();
  }, [active, progress, errors, onReady]);
  return (
    <div className="loading" role="status">
      <span>
        {errors.length
          ? "Не удалось загрузить текстуры. Обновите страницу."
          : "ГОТОВИМ ПУТЕШЕСТВИЕ"}
      </span>
      <div className="loading-track">
        <i style={{ width: `${progress}%` }} />
      </div>
      <small>{Math.round(progress)}%</small>
    </div>
  );
}
export default function SolarScene({
  controller,

  onReady,
  interactive,
  onSelect,
}: {
  controller: CameraControllerProps;

  onReady: () => void;
  interactive: boolean;
  onSelect: (index: number) => void;
}) {
  const [ready, setReady] = useState(false);
  const cameraOptions = useMemo(
    () => ({
      position: controller.runtime.position.toArray(),
      fov: 42,
      near: 0.03,
      far: 1800,
    }),
    [controller.runtime],
  );
  const [supported] = useState(() => {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  });
  if (!supported)
    return (
      <div className="webgl-error">
        <h2>Для путешествия нужен WebGL 2</h2>
        <p>
          Включите аппаратное ускорение или откройте сайт в современном
          браузере.
        </p>
      </div>
    );
  return (
    <>
      <Canvas
        dpr={[1, 1.6]}
        camera={cameraOptions}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <color attach="background" args={["#030509"]} />
        <ambientLight intensity={0.035} />
        <pointLight position={[0, 0, 0]} intensity={3.5} decay={0} />
        <StarField runtime={controller.runtime} />
        <Suspense fallback={null}>
          {planets.map((p, i) => (
            <Planet
              key={p.id}
              data={p}
              runtime={controller.runtime}
              index={i}
              interactive={interactive}
              onSelect={() => onSelect(i)}
            />
          ))}
          <Orbits runtime={controller.runtime} />
        </Suspense>
        <CinematicCameraController {...controller} />
        <AdaptiveDpr pixelated />
      </Canvas>
      {!ready && (
        <Loading
          onReady={() => {
            setReady(true);
            onReady();
          }}
        />
      )}
    </>
  );
}
