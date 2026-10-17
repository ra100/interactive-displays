import { z } from "zod";
import { IdSchema } from "./ids.ts";
import { SignalIdSchema } from "./signal.ts";

export const VIDEO_COMMANDS = ["play", "pause", "toggle", "restart"] as const;

export const VideoCommandSchema = z.enum(VIDEO_COMMANDS);

// Which displays an action runs on. `self` (the default) is the display that was touched, `others` every other
// display, `all` every display; or the displays named, and every display that shows one of the screens named.
export const TARGET_KEYWORDS = ["self", "others", "all"] as const;

export const TargetSchema = z.union([
  z.enum(TARGET_KEYWORDS),
  z
    .strictObject({
      displays: z.array(IdSchema).max(16).optional(),
      screens: z.array(IdSchema).max(16).optional(),
    })
    .refine((target) => (target.displays?.length ?? 0) + (target.screens?.length ?? 0) > 0, "Name a display or a screen"),
]);

// Seconds to wait before the action runs, for a beat that plays out: a tap, then the other screen reacts.
export const AfterSchema = z.number().min(0).max(600).optional();

// What a display control does when an actor uses it. Every control also flashes, and plays the theme's press
// sound when the show has sounds on, so a control without actions still answers a touch.
export const ActionSchema = z.discriminatedUnion("do", [
  // Show another published screen on this display only; `back` returns to the previous one.
  // With `on`, the displays named go there instead (or as well).
  z.strictObject({ do: z.literal("navigate"), screen: IdSchema, on: TargetSchema.optional(), after: AfterSchema }),
  z.strictObject({ do: z.literal("back"), on: TargetSchema.optional(), after: AfterSchema }),
  // Show-wide: changes every display. The show setting displayGlobalActions can switch these off.
  z.strictObject({ do: z.literal("setState"), state: IdSchema, after: AfterSchema }),
  // Show-wide: sets a shared signal to `value`, moves it by `delta`, or (with neither) to the control's own value
  // (the slider position, the chosen button, 1 or 0 for a toggle).
  z
    .strictObject({
      do: z.literal("setSignal"),
      signal: SignalIdSchema,
      value: z.number().optional(),
      delta: z.number().optional(),
      after: AfterSchema,
    })
    .refine((action) => action.value === undefined || action.delta === undefined, "Use value or delta, not both"),
  // Show-wide: runs a cue from the show's running order, e.g. a "Hit" button that sets the whole beat.
  z.strictObject({ do: z.literal("cue"), cue: IdSchema, after: AfterSchema }),
  // Controls a video widget by its node id: on this screen, or with `on` on the screens of the displays named.
  z.strictObject({ do: z.literal("video"), target: IdSchema, command: VideoCommandSchema, on: TargetSchema.optional(), after: AfterSchema }),
  // Plays a sound from the theme, such as "alert", here or on the displays named.
  z.strictObject({ do: z.literal("sound"), sound: IdSchema, on: TargetSchema.optional(), after: AfterSchema }),
  // Uses a control on the displays named, by its node id, as if someone touched it there: it flashes and runs
  // its own actions. One button can set off a whole scripted beat across the set.
  z.strictObject({ do: z.literal("trigger"), target: IdSchema, on: TargetSchema, after: AfterSchema }),
]);

export const ActionsSchema = z.array(ActionSchema).max(8);

// Actions the server runs, because they change more than the display that was touched.
export const GLOBAL_ACTIONS = ["setState", "setSignal", "cue"] as const;
// Actions the server runs for that display only: it decides what each display shows.
export const DISPLAY_ACTIONS = ["navigate", "back"] as const;

export type Action = z.infer<typeof ActionSchema>;
export type VideoCommand = z.infer<typeof VideoCommandSchema>;

export type ActionTarget = z.infer<typeof TargetSchema>;

// Actions that can run on other displays than the one touched.
export const TARGETED_ACTIONS = ["navigate", "back", "video", "sound", "trigger"] as const;

// The displays an action names, when it is not only the one touched.
export const actionTarget = (action: Action): ActionTarget => ("on" in action && action.on !== undefined ? action.on : "self");

// True when the action runs somewhere else than the display touched, or not at once: the server runs it.
export const isRemoteAction = (action: Action): boolean => actionTarget(action) !== "self" || (action.after ?? 0) > 0;

export const isServerAction = (action: Action): boolean =>
  (GLOBAL_ACTIONS as readonly string[]).includes(action.do) ||
  (DISPLAY_ACTIONS as readonly string[]).includes(action.do) ||
  action.do === "trigger" ||
  isRemoteAction(action);
