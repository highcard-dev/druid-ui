import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("async WIT contract", () => {
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
