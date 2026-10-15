import type { StateDef } from "@interactive-displays/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SoundPlayer } from "../runtime/sound.ts";
import { useSounds } from "./useSounds.ts";

const states: StateDef[] = [
  { id: "normal", label: "Normal", effect: "none" },
  { id: "red-alert", label: "Red alert", effect: "alert", sound: "alert" },
];

const setup = (enabled: boolean) => {
  const player: SoundPlayer = { play: vi.fn() };
  const hook = renderHook(
    ({ state, on }: { state: string | undefined; on: boolean }) => useSounds("lcars", on, state, states, player),
    { initialProps: { state: undefined as string | undefined, on: enabled } },
  );
  return { player, hook };
};

describe("useSounds", () => {
  it("plays a state's sound when the show enters it, not on the first snapshot", () => {
    const { player, hook } = setup(true);
    hook.rerender({ state: "red-alert", on: true });
    expect(player.play).not.toHaveBeenCalled();

    hook.rerender({ state: "normal", on: true });
    hook.rerender({ state: "red-alert", on: true });
    hook.rerender({ state: "red-alert", on: true });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledWith("lcars", "alert");
  });

  it("stays quiet while the show has sounds off", () => {
    const { player, hook } = setup(false);
    hook.rerender({ state: "normal", on: false });
    hook.rerender({ state: "red-alert", on: false });
    hook.result.current("press");
    expect(player.play).not.toHaveBeenCalled();

    hook.rerender({ state: "red-alert", on: true });
    hook.result.current("press");
    expect(player.play).toHaveBeenCalledWith("lcars", "press");
  });
});
