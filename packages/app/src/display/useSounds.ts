import type { StateDef } from "@interactive-displays/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSoundPlayer, type SoundPlayer } from "../runtime/sound.ts";

// Theme sounds for one display, while the show has sounds on: whatever controls ask for, and the sound of a
// state when the show enters it. Only live state changes sound: not connecting, which would sound on every
// reload, nor the state a reconnect's snapshot brings, which may have changed long ago.
export const useSounds = (
  themeId: string,
  enabled: boolean,
  entered: { state: string; at: number } | null,
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

  const handled = useRef(entered);
  useEffect(() => {
    const last = handled.current;
    if (!entered || (last?.state === entered.state && last.at === entered.at)) return;
    handled.current = entered;
    const sound = states.find((each) => each.id === entered.state)?.sound;
    if (sound) play(sound);
  }, [entered, states, play]);

  return play;
};
