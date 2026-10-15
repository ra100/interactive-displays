import type { StateDef } from "@interactive-displays/core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SoundPlayer } from "../runtime/sound.ts";
import { useSounds } from "./useSounds.ts";

const states: StateDef[] = [
  { id: "normal", label: "Normal", effect: "none" },
  { id: "red-alert", label: "Red alert", effect: "alert", sound: "alert" },
];

type Entered = { state: string; at: number } | null;

const setup = (enabled: boolean) => {
  const player: SoundPlayer = { play: vi.fn() };
  const hook = renderHook(({ entered, on }: { entered: Entered; on: boolean }) => useSounds("lcars", on, entered, states, player), {
    initialProps: { entered: null as Entered, on: enabled },
  });
  return { player, hook };
};

describe("useSounds", () => {
  it("plays a state's sound each time the show enters it", () => {
    const { player, hook } = setup(true);
    expect(player.play).not.toHaveBeenCalled();

    const alert = { state: "red-alert", at: 1 };
    hook.rerender({ entered: { state: "normal", at: 0 }, on: true });
    hook.rerender({ entered: alert, on: true });
    hook.rerender({ entered: alert, on: true });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledWith("lcars", "alert");

    hook.rerender({ entered: { state: "red-alert", at: 2 }, on: true });
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it("stays quiet while the show has sounds off, and does not catch up when they come on", () => {
    const { player, hook } = setup(false);
    hook.rerender({ entered: { state: "red-alert", at: 1 }, on: false });
    hook.result.current("press");
    expect(player.play).not.toHaveBeenCalled();

    hook.rerender({ entered: { state: "red-alert", at: 1 }, on: true });
    expect(player.play).not.toHaveBeenCalled();
    hook.result.current("press");
    expect(player.play).toHaveBeenCalledWith("lcars", "press");
  });
});
