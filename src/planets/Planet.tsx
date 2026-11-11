import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { type PlanetData, positionOf } from "../data/planets";
import type { JourneyRuntime } from "../animations/journeyTypes";
import {
  planetTexture,
  earthNight,
  earthClouds,
  earthNormal,
    earthSpecular,
    textureUrl,
} from "./textureQuality";
const vertex = `varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const earthFragment = `uniform sampler2D dayMap,nightMap,normalMap,waterMap,cloudMap;uniform float opacity,cloudOffset;varying vec2 vUv;varying vec3 vNormal,vWorld;
void main(){vec3 N=normalize(vNormal);vec3 q1=dFdx(vWorld),q2=dFdy(vWorld);vec2 s1=dFdx(vUv),s2=dFdy(vUv);vec3 T=normalize(q1*s2.y-q2*s1.y);vec3 B=-normalize(cross(N,T));vec3 n=texture2D(normalMap,vUv).xyz*2.-1.;n.xy*=.28;N=normalize(mat3(T,B,N)*n);
vec3 L=normalize(-vWorld),V=normalize(cameraPosition-vWorld),H=normalize(L+V);float NL=dot(N,L),NV=max(dot(N,V),.001);vec3 albedo=texture2D(dayMap,vUv).rgb;float ocean=texture2D(waterMap,vUv).r;float cloud=texture2D(cloudMap,vec2(fract(vUv.x+cloudOffset),vUv.y)).r;
vec3 color=albedo*(.012+max(NL,0.)*1.08)*(1.-.22*cloud*smoothstep(0.,.2,NL));
float rough=.26;float a=rough*rough,a2=a*a,NH=max(dot(N,H),0.);float D=a2/(3.14159*pow(NH*NH*(a2-1.)+1.,2.));float k=pow(rough+1.,2.)/8.;float G=NV/(NV*(1.-k)+k)*max(NL,0.)/(max(NL,0.)*(1.-k)+k);float F=.02+.98*pow(1.-max(dot(H,V),0.),5.);color+=vec3(.95,.98,1.)*ocean*min(1.2,D*G*F/(4.*NV+.001))*max(NL,0.);
color+=texture2D(nightMap,vUv).rgb*1.25*(1.-smoothstep(-.22,.12,NL));gl_FragColor=vec4(color,opacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const sunFragment = `uniform sampler2D dayMap;uniform float opacity;varying vec2 vUv;varying vec3 vNormal,vWorld;void main(){float facing=max(dot(normalize(vNormal),normalize(cameraPosition-vWorld)),0.);float limb=.46+.54*pow(facing,.4);vec3 color=texture2D(dayMap,vUv).rgb*limb*1.13;gl_FragColor=vec4(color,opacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const saturnFragment = `uniform sampler2D dayMap,ringMap;uniform vec3 center,ringNormal;uniform float radius,opacity;varying vec2 vUv;varying vec3 vNormal,vWorld;
void main(){vec3 L=normalize(-vWorld);float NL=max(dot(normalize(vNormal),L),0.);float shade=1.;float denom=dot(L,ringNormal);if(abs(denom)>.001){float t=-dot(vWorld-center,ringNormal)/denom;if(t>.005){float r=length(vWorld+L*t-center)/radius;if(r>1.25&&r<2.28){float alpha=texture2D(ringMap,vec2((r-1.25)/1.03,.5)).a;shade=1.-alpha*.8;}}}vec3 color=texture2D(dayMap,vUv).rgb*(.018+NL*1.08*shade);gl_FragColor=vec4(color,opacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function EarthMaterial({
  map,
  runtime,
}: {
  map: THREE.Texture;
  runtime: JourneyRuntime;
}) {
  const [night, normal, water, cloud] = useTexture([
    earthNight,
    earthNormal,
    earthSpecular,
    earthClouds,
  ]);
  useEffect(() => {
    night.colorSpace = THREE.SRGBColorSpace;
    night.needsUpdate = true;
  }, [night]);
  const uniforms = useMemo(
    () => ({
      dayMap: { value: map },
      nightMap: { value: night },
      normalMap: { value: normal },
      waterMap: { value: water },
      cloudMap: { value: cloud },
      cloudOffset: { value: 0 },
      opacity: { value: 1 },
    }),
    [map, night, normal, water, cloud],
  );
  useFrame(() => {
    uniforms.cloudOffset.value =
      (2.65 + runtime.rotationTime * 0.2 * (0.045 - 0.052)) / (Math.PI * 2);
  });
  return (
    <shaderMaterial
      transparent
      uniforms={uniforms}
      vertexShader={vertex}
      fragmentShader={earthFragment}
    />
  );
}
function Atmosphere({ data }: { data: PlanetData }) {
  const uniforms = useMemo(
    () => ({
      color: {
        value: new THREE.Color(data.id === "earth" ? "#73afff" : data.color),
      },
      opacity: { value: 1 },
    }),
    [data],
  );
  return (
    <mesh scale={data.radius * (data.id === "earth" ? 1.018 : 1.025)}>
      <sphereGeometry args={[1, 64, 48]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={`uniform vec3 color;uniform float opacity;varying vec3 vNormal,vWorld;void main(){vec3 N=normalize(vNormal),V=normalize(cameraPosition-vWorld),L=normalize(-vWorld);float facing=abs(dot(N,V));float rim=pow(1.-facing,3.4)*smoothstep(0.,.22,facing);float day=.12+.88*smoothstep(-.2,.6,dot(N,L));gl_FragColor=vec4(color,rim*day*.65*opacity);}`}
      />
    </mesh>
  );
}
function SunCorona({ radius }: { radius: number }) {
  const uniforms = useMemo(
    () => ({ radius: { value: radius * 1.55 }, opacity: { value: 1 } }),
    [radius],
  );
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`uniform float radius;varying vec2 vUv;void main(){vUv=uv;vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.);center.xy+=position.xy*radius;gl_Position=projectionMatrix*center;}`}
        fragmentShader={`uniform float opacity;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float glow=.16*exp(-max(0.,r-.64)*13.)*(1.-smoothstep(.82,1.,r));gl_FragColor=vec4(1.,.57,.22,glow*opacity);}`}
      />
    </mesh>
  );
}
function Clouds({
  radius,
  runtime,
}: {
  radius: number;
  runtime: JourneyRuntime;
}) {
  const map = useTexture(earthClouds),
    ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current)
      ref.current.rotation.y = runtime.rotationTime * 0.052 * 0.2;
  });
  return (
    <mesh ref={ref} scale={radius * 1.005}>
      <sphereGeometry args={[1, 96, 64]} />
      <meshStandardMaterial
        color="#ffffff"
        alphaMap={map}
        transparent
        opacity={0.72}
        roughness={1}
        depthWrite={false}
      />
    </mesh>
  );
}
function Rings({ data }: { data: PlanetData }) {
  const map = useTexture(textureUrl("/textures/2k_saturn_ring_alpha.png"));
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(
      data.radius * 1.25,
      data.radius * 2.28,
      192,
    );
    const pos = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(
        i,
        (Math.hypot(pos.getX(i), pos.getY(i)) - data.radius * 1.25) /
          (data.radius * 1.03),
        0.5,
      );
    return g;
  }, [data.radius]);
  const uniforms = useMemo(
    () => ({
      ringMap: { value: map },
      center: { value: new THREE.Vector3(...positionOf(data)) },
      radius: { value: data.radius },
      opacity: { value: 1 },
    }),
    [map, data],
  );
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={`uniform sampler2D ringMap;uniform vec3 center;uniform float radius,opacity;varying vec2 vUv;varying vec3 vWorld,vNormal;void main(){vec4 tex=texture2D(ringMap,vUv);vec3 L=normalize(-vWorld),rel=vWorld-center;float b=dot(rel,L),c=dot(rel,rel)-radius*radius;float shadow=b<0.&&b*b>c?.15:1.;float light=.4+.6*abs(dot(normalize(vNormal),L));gl_FragColor=vec4(tex.rgb*light*shadow,tex.a*opacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}
      />
    </mesh>
  );
}
export default function Planet({
  data,
  runtime,
  index,
  interactive,
  onSelect,
}: {
  data: PlanetData;
  runtime: JourneyRuntime;
  index: number;
  interactive: boolean;
  onSelect: () => void;
}) {
  const map = useTexture(planetTexture(index)),
    ringMap = useTexture(textureUrl("/textures/2k_saturn_ring_alpha.png"));
  const surface = useRef<THREE.Mesh>(null),
    group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!interactive) {
      setHovered(false);
      document.body.style.cursor = "auto";
    }
  }, [interactive]);
  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
    ringMap.colorSpace = THREE.SRGBColorSpace;
    ringMap.needsUpdate = true;
  }, [map, ringMap]);
  const uniforms = useMemo(
    () => ({
      dayMap: { value: map },
      ringMap: { value: ringMap },
      center: { value: new THREE.Vector3(...positionOf(data)) },
      ringNormal: {
        value: new THREE.Vector3(
          -Math.sin((data.tilt * Math.PI) / 180),
          Math.cos((data.tilt * Math.PI) / 180),
          0,
        ),
      },
      radius: { value: data.radius },
      opacity: { value: 1 },
    }),
    [map, ringMap, data],
  );
  useFrame(() => {
    // Every object remains visible throughout navigation. Only the opening reveal
    // changes alpha; arrival size is created entirely by camera distance.
    const visibility = index === 0 ? runtime.sun : runtime.worlds;
    if (group.current) {
      group.current.visible = visibility > 0.0001;
      group.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.Material & {
            uniforms?: Record<string, { value: unknown }>;
          };
          if (material.uniforms?.opacity)
            material.uniforms.opacity.value = visibility;
          else {
            material.userData.baseOpacity ??= material.opacity;
            material.opacity = material.userData.baseOpacity * visibility;
          }
        }
      });
    }
    if (surface.current)
      surface.current.rotation.y =
        (data.id === "earth" ? 2.65 : data.id === "jupiter" ? 5.3 : 0) +
        runtime.rotationTime * data.rotation * 0.2;
  });
  const custom = data.id === "sun" || data.id === "saturn";
  return (
    <group ref={group} position={positionOf(data)}>
      {
        <mesh
          scale={Math.max(data.radius, innerWidth < 760 ? 2 : 1.1)}
          onClick={(e) => {
            if (!runtime.canSelect) return;
            e.stopPropagation();
            onSelect();
          }}
          onPointerOver={(e) => {
            if (!runtime.canSelect) return;
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      }
      <group rotation={[0, 0, (data.tilt * Math.PI) / 180]}>
        <mesh ref={surface} scale={data.radius}>
          <sphereGeometry args={[1, 112, 80]} />
          {data.id === "earth" ? (
            <EarthMaterial map={map} runtime={runtime} />
          ) : custom ? (
            <shaderMaterial
              transparent
              uniforms={uniforms}
              vertexShader={vertex}
              fragmentShader={data.id === "sun" ? sunFragment : saturnFragment}
            />
          ) : (
            <meshStandardMaterial
              map={map}
              roughness={
                data.id === "mercury" ? 0.96 : data.id === "mars" ? 0.98 : 1
              }
              metalness={0}
              transparent
            />
          )}
        </mesh>
        {data.id === "earth" && (
          <Clouds radius={data.radius} runtime={runtime} />
        )}{" "}
        {data.id === "saturn" && <Rings data={data} />}
      </group>
      {data.id === "sun" && <SunCorona radius={data.radius} />}{" "}
      {["earth", "venus", "uranus", "neptune"].includes(data.id) && (
        <Atmosphere data={data} />
      )}
      {interactive && (
        <Html
          position={[0, data.radius + 0.65, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <span className={`world-label ${hovered ? "hovered" : ""}`}>
            {data.name}
          </span>
        </Html>
      )}
    </group>
  );
}
