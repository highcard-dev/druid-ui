import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repository checkout policy", () => {
  it("keeps the POSIX postinstall script LF-only", () => {
    const script = readFileSync(
      `${process.cwd()}/scripts/copy-plattform-wit.sh`,
      "utf8",
    );

    expect(script).not.toContain("\r");
  });
});
