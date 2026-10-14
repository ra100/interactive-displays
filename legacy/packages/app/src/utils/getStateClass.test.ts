import { describe, it, expect } from "vitest";
import { getStateClass } from "./getStateClass";

describe("getStateClass", () => {
  it("returns empty string for normal state", () => {
    expect(getStateClass("normal")).toBe("");
  });

  it("returns state--alert for alert state", () => {
    expect(getStateClass("alert")).toBe("state--alert");
  });

  it("returns state--active for active state", () => {
    expect(getStateClass("active")).toBe("state--active");
  });

  it("returns state--damaged for damaged state", () => {
    expect(getStateClass("damaged")).toBe("state--damaged");
  });
});
