// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { genTypes } from "./gen-types";

describe("genTypes", () => {
  it("generates types from a temporary WIT directory on Windows", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "druid-ui-gen-types-"),
    );
    const outputDirectory = join(temporaryDirectory, "types");
    const witDirectory = join(temporaryDirectory, "wit");

    try {
      await genTypes([], "druid-ui", outputDirectory, witDirectory);

      const generatedTypes = await readFile(
        join(outputDirectory, "druid-ui.d.ts"),
        "utf8",
      );
      expect(generatedTypes).toContain("declare module 'druid:ui/druid-ui'");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
