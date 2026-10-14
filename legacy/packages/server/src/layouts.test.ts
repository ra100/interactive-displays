import { describe, it, expect } from "vitest";
import { validateLayoutId } from "./validation";

describe("layouts", () => {
  describe("validateLayoutId", () => {
    it("accepts valid alphanumeric IDs", () => {
      expect(validateLayoutId("default")).toBe("default");
      expect(validateLayoutId("layout123")).toBe("layout123");
      expect(validateLayoutId("my-layout")).toBe("my-layout");
      expect(validateLayoutId("layout_v2")).toBe("layout_v2");
    });

    it("rejects IDs with path traversal attempts", () => {
      expect(() => validateLayoutId("../secret")).toThrow();
      expect(() => validateLayoutId("..\\secret")).toThrow();
      expect(() => validateLayoutId("foo/../bar")).toThrow();
    });

    it("rejects IDs with invalid characters", () => {
      expect(() => validateLayoutId("foo/bar")).toThrow();
      expect(() => validateLayoutId("foo\\bar")).toThrow();
      expect(() => validateLayoutId("foo bar")).toThrow();
      expect(() => validateLayoutId("foo:bar")).toThrow();
    });

    it("rejects empty strings", () => {
      expect(() => validateLayoutId("")).toThrow();
    });

    it("rejects IDs that are too long", () => {
      const longId = "a".repeat(101);
      expect(() => validateLayoutId(longId)).toThrow();
    });

    it("accepts IDs at max length", () => {
      const maxId = "a".repeat(100);
      expect(validateLayoutId(maxId)).toBe(maxId);
    });
  });
});
