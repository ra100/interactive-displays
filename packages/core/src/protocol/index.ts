import { z } from "zod";
import { IdSchema } from "../schema/ids.ts";
import type { Screen } from "../schema/screen.ts";

// Bumped on any breaking change to events or payloads; a display reloads when the server's differs.
export const PROTOCOL_VERSION = 1;

export const HelloSchema = z.object({
  role: z.literal("display"),
  displayId: IdSchema,
  protocol: z.number().int(),
});

export type Hello = z.infer<typeof HelloSchema>;

// Everything a display needs to render, sent on every hello so a reconnect misses nothing.
export interface DisplaySnapshot {
  protocol: number;
  show: { id: string; name: string; theme: { id: string } };
  display: { id: string; name?: string };
  screen: Screen | null;
}

export type ProtocolErrorCode = "INVALID_HELLO" | "NO_ACTIVE_SHOW";

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
}

export interface ServerToClientEvents {
  snapshot: (snapshot: DisplaySnapshot) => void;
  error: (error: ProtocolError) => void;
}

export interface ClientToServerEvents {
  hello: (hello: Hello) => void;
}
