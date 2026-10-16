import { describe, expect, it } from "vitest";
import { timeAgo } from "./timeAgo.ts";

describe("timeAgo", () => {
  const now = Date.parse("2026-10-15T12:00:00.000Z");
  it.each([
    ["2026-10-15T11:59:30.000Z", "30 seconds ago"],
    ["2026-10-15T11:55:00.000Z", "5 minutes ago"],
    ["2026-10-15T09:00:00.000Z", "3 hours ago"],
    ["2026-10-14T12:00:00.000Z", "yesterday"],
  ])("%s → %s", (iso, text) => {
    expect(timeAgo(iso, now)).toBe(text);
  });
});
