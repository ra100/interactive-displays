import { z } from "zod";
import type { LintIssue } from "../lint/lintScreen.ts";
import { IdSchema } from "../schema/ids.ts";
import type { Profile, Screen } from "../schema/screen.ts";
import type { Show, StateDef } from "../schema/show.ts";

// Bumped on any breaking change to events or payloads; a display reloads when the server's differs.
export const PROTOCOL_VERSION = 3;

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

// Everything a display needs to render, sent on every hello so a reconnect misses nothing.
// It is sent again whenever the display's screen or assignment changes.
export interface DisplaySnapshot {
  protocol: number;
  show: { id: string; name: string; theme: Show["theme"]; states: StateDef[] };
  // The current show state id; always one of show.states.
  state: string;
  display: { id: string; name?: string };
  screen: Screen | null;
  // True while the display shows a draft sent from the editor instead of the published screen.
  preview: boolean;
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
  showing: string | null;
  // The screen whose draft the display is previewing, if any.
  preview: string | null;
  connected: boolean;
  lastSeen: string | null;
}

// What the operator console and the editor need to know about the show, pushed whenever it changes.
export interface ShowOverview {
  protocol: number;
  show: Show;
  state: string;
  screens: ScreenSummary[];
  displays: DisplayStatus[];
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
  error: (error: ProtocolError) => void;
}

export interface ClientToServerEvents {
  hello: (hello: Hello) => void;
  watch: (watch: Watch) => void;
}
