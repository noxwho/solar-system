export type Stage =
  | { kind: "system" }
  | { kind: "planet"; index: number; level: "full" | "close" };
export interface Navigation {
  entries: Stage[];
  cursor: number;
}
export const systemStage: Stage = { kind: "system" };
export const equalStage = (a: Stage, b: Stage) =>
  a.kind === b.kind &&
  (a.kind === "system" ||
    b.kind === "system" ||
    (a.index === b.index && a.level === b.level));
export function nextStage(stage: Stage): Stage | null {
  if (stage.kind === "system")
    return { kind: "planet", index: 0, level: "full" };
  if (stage.level === "full") return { ...stage, level: "close" };
  return stage.index < 8
    ? { kind: "planet", index: stage.index + 1, level: "full" }
    : null;
}
export function pushStage(nav: Navigation, stage: Stage): Navigation {
  if (equalStage(nav.entries[nav.cursor], stage)) return nav;
  return {
    entries: [...nav.entries.slice(0, nav.cursor + 1), stage],
    cursor: nav.cursor + 1,
  };
}
export function moveNavigation(nav: Navigation, direction: -1 | 1): Navigation {
  if (direction === -1)
    return nav.cursor > 0 ? { ...nav, cursor: nav.cursor - 1 } : nav;
  if (nav.cursor < nav.entries.length - 1)
    return { ...nav, cursor: nav.cursor + 1 };
  const stage = nextStage(nav.entries[nav.cursor]);
  return stage ? pushStage(nav, stage) : nav;
}
