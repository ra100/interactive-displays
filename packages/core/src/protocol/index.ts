import { z } from "zod";
import type { LintIssue } from "../lint/lintScreen.ts";
import type { VideoCommand } from "../schema/action.ts";
import { IdSchema } from "../schema/ids.ts";
import type { Profile, Screen } from "../schema/screen.ts";
import type { Panel, Show, StateDef } from "../schema/show.ts";
import type { SignalDef, SignalValue } from "../schema/signal.ts";

// Bumped on any breaking change to events or payloads; a display reloads when the server's differs.
export const PROTOCOL_VERSION = 5;

const ProtocolSchema = z.number().int();
const TokenSchema = z.string().min(1).max(200).optional();

// Displays render one screen. Operators run the show and builders edit screens; both get the show overview and
// live updates, and need the editor token when the server has one.
export const HelloSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("display"), displayId: IdSchema, protocol: ProtocolSchema }),
  z.object({ role: z.literal("operator"), protocol: ProtocolSchema, token: TokenSchema }),
  z.object({ role: z.literal("builder"), protocol: ProtocolSchema, token: TokenSchema }),
]);

export type Hello = z.infer<typeof HelloSchema>;
export type Role = Hello["role"];

// A builder follows the draft of the screen it has open; null stops following.
export const WatchSchema = z.object({ screenId: IdSchema.nullable() });

export type Watch = z.infer<typeof WatchSchema>;

// An actor used a control on a display. The server looks the node up on the screen that display shows and runs
// the actions that are the server's to run (navigation, show state, shared signals); the display runs the rest.
// `value` is the control's own value: the slider position, the chosen option, 1 or 0 for a toggle.
// `moving` marks a control still being used (a slider being dragged): only its shared values follow it, and
// navigation and show state wait for the final use.
export const PressSchema = z.object({
  nodeId: IdSchema,
  value: z.number().finite().optional(),
  moving: z.boolean().optional(),
});

export type Press = z.infer<typeof PressSchema>;

// Shared signal values by id; updates carry only what changed.
export type SignalValues = Record<string, SignalValue>;

// Everything a display needs to render, sent on every hello so a reconnect misses nothing.
// It is sent again whenever the display's screen or assignment changes.
export interface DisplaySnapshot {
  protocol: number;
  show: {
    id: string;
    name: string;
    theme: Show["theme"];
    states: StateDef[];
    signals: SignalDef[];
    // Whether displays play theme sounds.
    sounds: boolean;
    // The theme whose sounds play, when not the show's theme.
    soundPack?: string;
  };
  // The current show state id; always one of show.states.
  state: string;
  // Current values of the server-owned shared signals.
  signals: SignalValues;
  // scale is how big this display draws everything (its own scale, or the show's); panel is the physical
  // screen it draws on (its own diagonal or the show's) and how tall buttons are on it.
  display: { id: string; name?: string; scale: number; panel: Panel };
  screen: Screen | null;
  // True while the display shows a draft sent from the editor instead of the published screen.
  preview: boolean;
  // True when a control took this display to another screen, so a back action has somewhere to go.
  navigated: boolean;
}

export interface ScreenSummary {
  id: string;
  name: string;
  section?: string;
  tags: string[];
  profile: Profile;
  revision: number;
  // The revision on air, or null if the screen has never been published.
  published: number | null;
}

export interface DisplayStatus {
  id: string;
  name?: string;
  // The screen assigned to this display, if any; otherwise it shows the show's default screen.
  assigned?: string;
  // The display's own scale, when it does not use the show's.
  scale?: number;
  // The display's own panel diagonal in inches, when it is not the show's.
  inches?: number;
  showing: string | null;
  // The screen whose draft the display is previewing, if any.
  preview: string | null;
  // The screen a control on the display navigated to, if any (it shows that instead of its own).
  navigated: string | null;
  // Ids of the video widgets on the screen it shows, for the operator's transport controls.
  videos: string[];
  connected: boolean;
  lastSeen: string | null;
}

// What the operator console and the editor need to know about the show, pushed whenever it changes.
export interface ShowOverview {
  protocol: number;
  show: Show;
  state: string;
  // The last cue run (GO runs the one after it), or null before the first.
  cue: string | null;
  signals: SignalValues;
  screens: ScreenSummary[];
  displays: DisplayStatus[];
}

// One saved revision of a screen draft, newest first in lists. `savedAt` is null when it is not known.
export interface RevisionInfo {
  revision: number;
  savedAt: string | null;
}

// A file in the show's assets folder.
export interface AssetInfo {
  name: string;
  kind: "image" | "video";
  type: string;
  size: number;
  modified: string;
}

// The current draft of a watched screen; `screen` is null once the screen is deleted.
export interface ScreenUpdate {
  screenId: string;
  screen: Screen | null;
  lint: LintIssue[];
}

export type ProtocolErrorCode = "INVALID_HELLO" | "NO_ACTIVE_SHOW" | "UNAUTHORIZED";

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
}

export interface ServerToClientEvents {
  snapshot: (snapshot: DisplaySnapshot) => void;
  // Show-wide state change, sent to every client at once.
  state: (update: { state: string }) => void;
  // Ask a display to flash its name so the crew can find it.
  identify: (payload: { label: string }) => void;
  // Ask a display to reload the page, for example after a stuck browser.
  reload: () => void;
  overview: (overview: ShowOverview) => void;
  screen: (update: ScreenUpdate) => void;
  // Changed shared signal values, batched to at most ten updates a second.
  signals: (update: { values: SignalValues }) => void;
  // From the operator: play, pause or restart a video widget on this display.
  video: (command: { target: string; command: VideoCommand }) => void;
  // From a control on another display (or a delayed one here): play a theme sound.
  sound: (command: { sound: string }) => void;
  // A control on another display used this display's control `nodeId`: flash it and run its sounds and videos;
  // the server has run the rest of its actions.
  trigger: (command: { nodeId: string }) => void;
  error: (error: ProtocolError) => void;
}

export interface ClientToServerEvents {
  hello: (hello: Hello) => void;
  watch: (watch: Watch) => void;
  press: (press: Press) => void;
}
