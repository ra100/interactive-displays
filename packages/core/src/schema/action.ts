import { z } from "zod";
import { IdSchema } from "./ids.ts";
import { SignalIdSchema } from "./signal.ts";

export const VIDEO_COMMANDS = ["play", "pause", "toggle", "restart"] as const;

export const VideoCommandSchema = z.enum(VIDEO_COMMANDS);

// What a display control does when an actor uses it. Every control also flashes, and plays the theme's press
// sound when the show has sounds on, so a control without actions still answers a touch.
export const ActionSchema = z.discriminatedUnion("do", [
  // Show another published screen on this display only; `back` returns to the previous one.
  z.strictObject({ do: z.literal("navigate"), screen: IdSchema }),
  z.strictObject({ do: z.literal("back") }),
  // Show-wide: changes every display. The show setting displayGlobalActions can switch these off.
  z.strictObject({ do: z.literal("setState"), state: IdSchema }),
  // Show-wide: sets a shared signal to `value`, moves it by `delta`, or (with neither) to the control's own value
  // (the slider position, the chosen button, 1 or 0 for a toggle).
  z
    .strictObject({
      do: z.literal("setSignal"),
      signal: SignalIdSchema,
      value: z.number().optional(),
      delta: z.number().optional(),
    })
    .refine((action) => action.value === undefined || action.delta === undefined, "Use value or delta, not both"),
  // Show-wide: runs a cue from the show's running order, e.g. a "Hit" button that sets the whole beat.
  z.strictObject({ do: z.literal("cue"), cue: IdSchema }),
  // Controls a video widget on the same screen, by its node id.
  z.strictObject({ do: z.literal("video"), target: IdSchema, command: VideoCommandSchema }),
  // Plays a sound from the theme, such as "alert".
  z.strictObject({ do: z.literal("sound"), sound: IdSchema }),
]);

export const ActionsSchema = z.array(ActionSchema).max(8);

// Actions the server runs, because they change more than the display that was touched.
export const GLOBAL_ACTIONS = ["setState", "setSignal", "cue"] as const;
// Actions the server runs for that display only: it decides what each display shows.
export const DISPLAY_ACTIONS = ["navigate", "back"] as const;

export type Action = z.infer<typeof ActionSchema>;
export type VideoCommand = z.infer<typeof VideoCommandSchema>;

export const isServerAction = (action: Action): boolean =>
  (GLOBAL_ACTIONS as readonly string[]).includes(action.do) || (DISPLAY_ACTIONS as readonly string[]).includes(action.do);
