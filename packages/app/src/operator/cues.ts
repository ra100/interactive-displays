import { type Cue, isSettable, type ShowOverview, type SignalValues, slugify, uniqueId } from "@interactive-displays/core";

// A cue that puts the show back the way it is now: the state, every shared manual value and every display's
// assigned screen. Rehearse a beat by hand, then record it.
export const cueFromNow = (overview: ShowOverview, values: SignalValues, label: string): Cue => {
  const signals: Record<string, number> = {};
  for (const signal of overview.show.signals) {
    const value = values[signal.id];
    if (isSettable(signal) && typeof value === "number") signals[signal.id] = value;
  }
  const screens = Object.fromEntries(overview.show.displays.map((display) => [display.id, display.screen ?? null]));
  const id = uniqueId(slugify(label) || "cue", new Set(overview.show.cues.map((cue) => cue.id)));
  return {
    id,
    label,
    state: overview.state,
    ...(Object.keys(signals).length > 0 ? { signals } : {}),
    ...(Object.keys(screens).length > 0 ? { screens } : {}),
  };
};

// The cues with one moved up (-1) or down (+1); unchanged at either end.
export const moveCue = (cues: readonly Cue[], id: string, by: -1 | 1): Cue[] => {
  const from = cues.findIndex((cue) => cue.id === id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= cues.length) return [...cues];
  const next = [...cues];
  const [cue] = next.splice(from, 1);
  if (cue) next.splice(to, 0, cue);
  return next;
};

// What a cue changes, in a few words for the operator.
export const cueSummary = (cue: Cue, overview: ShowOverview): string => {
  const parts: string[] = [];
  if (cue.state) parts.push(overview.show.states.find((state) => state.id === cue.state)?.label ?? cue.state);
  const signals = Object.keys(cue.signals ?? {}).length;
  if (signals > 0) parts.push(`${signals} value${signals === 1 ? "" : "s"}`);
  const screens = Object.keys(cue.screens ?? {}).length;
  if (screens > 0) parts.push(`${screens} screen${screens === 1 ? "" : "s"}`);
  const videos = cue.videos?.length ?? 0;
  if (videos > 0) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
  return parts.join(" · ");
};
