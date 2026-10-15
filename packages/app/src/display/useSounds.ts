import type { StateDef } from "@interactive-displays/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSoundPlayer, type SoundPlayer } from "../runtime/sound.ts";

// Theme sounds for one display, while the show has sounds on: whatever controls ask for, and the sound of a
// state when the show enters it (not when the display first connects, which would sound on every reload).
export const useSounds = (
  themeId: string,
  enabled: boolean,
  state: string | undefined,
  states: readonly StateDef[],
  player?: SoundPlayer,
): ((soundId: string) => void) => {
  const [ownPlayer] = useState(createSoundPlayer);
  const active = player ?? ownPlayer;
  const play = useCallback(
    (soundId: string) => {
      if (enabled) active.play(themeId, soundId);
    },
    [active, themeId, enabled],
  );

  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before === undefined || state === undefined || before === state) return;
    const sound = states.find((each) => each.id === state)?.sound;
    if (sound) play(sound);
  }, [state, states, play]);

  return play;
};
