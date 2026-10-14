import { describe, expect, it } from "vitest";
import { IdSchema } from "./ids.ts";

describe("IdSchema", () => {
  it.each(["welcome", "d-1", "screen_2", "0abc"])("accepts %s", (id) => {
    expect(IdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["", "Welcome", "-lead", "has space", "../escape", "a/b", "a".repeat(65)])(
    "rejects %j",
    (id) => {
      expect(IdSchema.safeParse(id).success).toBe(false);
    },
  );
});
