import type { RefObject } from "react";
import type { JourneyRuntime } from "./journeyTypes";
import type { Stage } from "./navigation";
export interface CameraCommand {
  id: number;
  stage: Stage;
}
export interface CameraControllerProps {
  runtime: JourneyRuntime;
  ready: boolean;
  reduced: boolean;
  command: CameraCommand | null;
  infoRef: RefObject<HTMLElement | null>;
  overviewRef: RefObject<HTMLElement | null>;
  onMoving: (moving: boolean) => void;
  onArrive: (stage: Stage) => void;
  onIntro: () => void;
}
