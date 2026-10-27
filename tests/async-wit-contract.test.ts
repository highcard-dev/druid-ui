import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("async WIT contract", () => {
  it("keeps the platform command bindings aligned with shipped examples", async () => {
    const source = await readFile("packages/plattform/wit/druid-plattform.wit", "utf8");
    expect(source).toContain("ensure-file-service: func(watch: bool) -> string;");
    expect(source).toContain("add-and-run-command: func(name: string, command: command-instruction) -> string;");
    expect(source).toContain("stop-command: func(name: string) -> string;");
    for (const example of ["druid-plattform", "druid-plattform-no-sandbox", "starter-component-plattform"]) {
      expect(await readFile(`examples/${example}/wit/druid-plattform.wit`, "utf8")).toBe(source);
    }
  });
  it.each(["wit/druid-component.wit", "packages/build/wit/druid-component.wit"])(
    "%s transports error messages",
    async (path) => {
      const source = await readFile(path, "utf8");
      expect(source).toContain(
        "async-complete: func(id: string, value: result<string, string>);",
      );
    },
  );
});
