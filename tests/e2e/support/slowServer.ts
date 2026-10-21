import { warpTime } from "./slowmo.ts";

// Loaded before the server (`node --import`) when the showcase video records in slow motion: the server's clocks
// and timers (ticking values, delayed actions) slow down with the pages'.
warpTime({ rate: Number(process.env["SLOWMO_RATE"] ?? 1), epoch: Number(process.env["SLOWMO_EPOCH"] ?? Date.now()) });
