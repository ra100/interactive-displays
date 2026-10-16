import { describe, expect, it } from "vitest";
import { bearerToken, tokenAccepted } from "./auth.ts";

describe("tokenAccepted", () => {
  it("accepts anything when no token is configured", () => {
    expect(tokenAccepted(undefined, undefined)).toBe(true);
    expect(tokenAccepted(undefined, "x")).toBe(true);
  });

  it("requires the exact token when one is configured", () => {
    expect(tokenAccepted("secret-token", "secret-token")).toBe(true);
    expect(tokenAccepted("secret-token", "secret-tokeN")).toBe(false);
    expect(tokenAccepted("secret-token", "secret")).toBe(false);
    expect(tokenAccepted("secret-token", undefined)).toBe(false);
  });
});

describe("bearerToken", () => {
  it("reads a bearer token", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer abc123 ")).toBe("abc123");
  });

  it("ignores other schemes and malformed headers", () => {
    expect(bearerToken(undefined)).toBeUndefined();
    expect(bearerToken("Basic abc")).toBeUndefined();
    expect(bearerToken("Bearer a b")).toBeUndefined();
  });
});
