import { beforeEach, describe, expect, it } from "vitest";
import { clearNodes, createDomFromIdRec, dfunc } from "./host-functions";

describe("host property rendering", () => {
  beforeEach(() => clearNodes());

  it("renders semantic HTML attributes through snabbdom attrs", () => {
    const id = dfunc(
      "input",
      {
        prop: [
          { key: "id", value: "players" },
          { key: "class", value: "field-input" },
          { key: "aria-label", value: "Max players" },
          { key: "aria-describedby", value: "players-description" },
          { key: "role", value: "spinbutton" },
        ],
        on: [],
      },
      [],
    );

    const vnode = createDomFromIdRec(id, () => undefined);

    expect(typeof vnode).not.toBe("string");
    if (typeof vnode === "string") return;
    expect(vnode.data?.props).toEqual({ id: "players" });
    expect(vnode.data?.attrs).toEqual({
      "aria-label": "Max players",
      "aria-describedby": "players-description",
      class: "field-input",
      role: "spinbutton",
    });
  });

  it("renders label for as an attribute", () => {
    const id = dfunc(
      "label",
      { prop: [{ key: "for", value: "players" }], on: [] },
      ["Max players"],
    );

    const vnode = createDomFromIdRec(id, () => undefined);

    expect(typeof vnode).not.toBe("string");
    if (typeof vnode === "string") return;
    expect(vnode.data?.attrs).toEqual({ for: "players" });
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("coerces boolean property string %s", (value, expected) => {
    const id = dfunc(
      "button",
      { prop: [{ key: "disabled", value }], on: [] },
      ["Save"],
    );

    const vnode = createDomFromIdRec(id, () => undefined);

    expect(typeof vnode).not.toBe("string");
    if (typeof vnode === "string") return;
    expect(vnode.data?.props?.disabled).toBe(expected);
  });
});
