import { describe, expect, it } from "vitest";
import { lowerPropertyValue } from "./props";

describe("WIT property lowering", () => {
  it("lowers numbers and booleans to strings", () => {
    expect(lowerPropertyValue(1)).toBe("1");
    expect(lowerPropertyValue(false)).toBe("false");
    expect(lowerPropertyValue("value")).toBe("value");
  });

  it("omits absent optional values", () => {
    expect(lowerPropertyValue(undefined)).toBeUndefined();
    expect(lowerPropertyValue(null)).toBeUndefined();
  });
});
