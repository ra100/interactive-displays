import { describe, expect, it } from "vitest";
import { HelloSchema, PROTOCOL_VERSION } from "./index.ts";

describe("HelloSchema", () => {
  it("accepts a display hello", () => {
    const hello = { role: "display", displayId: "bridge-1", protocol: PROTOCOL_VERSION };
    expect(HelloSchema.parse(hello)).toEqual(hello);
  });

  it("rejects an unsafe display id", () => {
    const result = HelloSchema.safeParse({ role: "display", displayId: "../x", protocol: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects roles that do not exist yet", () => {
    const result = HelloSchema.safeParse({ role: "operator", displayId: "x", protocol: 1 });
    expect(result.success).toBe(false);
  });
});
