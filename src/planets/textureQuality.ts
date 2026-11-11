
import { planets } from "../data/planets";

// Automatically account for the Vite base path.
export const textureUrl = (path: string): string => {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
};

const nav = navigator as Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

// Select once per load; resizing never replaces textures mid-flight.
export const desktopTextures =
  innerWidth >= 1000 &&
  !nav.connection?.saveData &&
  (nav.deviceMemory ?? 8) >= 4;

const highRes = new Set([
  "sun",
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
]);

export function planetTexture(index: number) {
  const p = planets[index];

  return textureUrl(
    desktopTextures && highRes.has(p.id)
      ? `/textures/desktop/${p.id}.jpg`
      : p.texture
  );
}

export const earthNight = textureUrl(
  desktopTextures
    ? "/textures/desktop/earth-night.jpg"
    : "/textures/2k_earth_nightmap.jpg"
);

export const earthClouds = textureUrl(
  desktopTextures
    ? "/textures/desktop/earth-clouds.jpg"
    : "/textures/2k_earth_clouds.jpg"
);

export const earthNormal = textureUrl("/textures/earth-normal.png");

export const earthSpecular = textureUrl("/textures/earth-specular.png");

export const preloadTextures = [
  ...planets.map((_, i) => planetTexture(i)),
  earthNight,
  earthClouds,
  earthNormal,
  earthSpecular,
  textureUrl("/textures/2k_saturn_ring_alpha.png"),
];
