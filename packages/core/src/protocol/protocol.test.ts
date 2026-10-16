import { describe, expect, it } from "vitest";
import { HelloSchema, PROTOCOL_VERSION, WatchSchema } from "./index.ts";

describe("HelloSchema", () => {
  it("accepts a display hello", () => {
    const hello = { role: "display", displayId: "bridge-1", protocol: PROTOCOL_VERSION };
    expect(HelloSchema.parse(hello)).toEqual(hello);
  });

  it("rejects an unsafe display id", () => {
    const result = HelloSchema.safeParse({ role: "display", displayId: "../x", protocol: 1 });
    expect(result.success).toBe(false);
  });

  it("requires a display id for displays", () => {
    expect(HelloSchema.safeParse({ role: "display", protocol: PROTOCOL_VERSION }).success).toBe(false);
  });

  it.each(["operator", "builder"])("accepts an %s hello with or without a token", (role) => {
    expect(HelloSchema.safeParse({ role, protocol: PROTOCOL_VERSION }).success).toBe(true);
    expect(HelloSchema.parse({ role, protocol: PROTOCOL_VERSION, token: "secret" })).toMatchObject({ token: "secret" });
  });

  it("rejects unknown roles and empty tokens", () => {
    expect(HelloSchema.safeParse({ role: "admin", protocol: PROTOCOL_VERSION }).success).toBe(false);
    expect(HelloSchema.safeParse({ role: "operator", protocol: PROTOCOL_VERSION, token: "" }).success).toBe(false);
  });
});

describe("WatchSchema", () => {
  it("accepts a screen id or null", () => {
    expect(WatchSchema.parse({ screenId: "bridge" })).toEqual({ screenId: "bridge" });
    expect(WatchSchema.parse({ screenId: null })).toEqual({ screenId: null });
  });

  it("rejects unsafe ids", () => {
    expect(WatchSchema.safeParse({ screenId: "../show" }).success).toBe(false);
  });
});
