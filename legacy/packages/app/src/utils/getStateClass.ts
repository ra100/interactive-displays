import type { GlobalState } from "@interactive-displays/shared";

const STATE_CLASS_MAP: Record<GlobalState, string> = {
  normal: "",
  alert: "state--alert",
  active: "state--active",
  damaged: "state--damaged",
};

export function getStateClass(globalState: GlobalState): string {
  return STATE_CLASS_MAP[globalState];
}
