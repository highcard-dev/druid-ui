import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function runPackageScript(scriptName: "build" | "watch"): string[] {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  const directory = mkdtempSync(join(tmpdir(), "druid-ui-turbo-args-"));
  temporaryDirectories.push(directory);

  const capturePath = join(directory, "arguments.json");
  const captureScript = join(directory, "capture.mjs");
  writeFileSync(
    captureScript,
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(capturePath)}, JSON.stringify(process.argv.slice(2)));\n`,
  );

  if (process.platform === "win32") {
    writeFileSync(
      join(directory, "turbo.cmd"),
      `@echo off\r\n"${process.execPath}" "${captureScript}" %*\r\n`,
    );
  } else {
    const executable = join(directory, "turbo");
    writeFileSync(
      executable,
      `#!/bin/sh\nexec "${process.execPath}" "${captureScript}" "$@"\n`,
    );
    chmodSync(executable, 0o755);
  }

  const result = spawnSync(packageJson.scripts[scriptName], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${directory}${delimiter}${process.env.PATH ?? ""}`,
    },
    shell: true,
  });

  expect(
    result.status,
    `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  ).toBe(0);

  return JSON.parse(readFileSync(capturePath, "utf8")) as string[];
}

describe("cross-platform package scripts", () => {
  it("passes the build package glob to Turbo without quote characters", () => {
    expect(runPackageScript("build")).toEqual([
      "build",
      "--filter=./packages/*",
    ]);
  });

  it("passes the watch package glob to Turbo without quote characters", () => {
    expect(runPackageScript("watch")).toEqual([
      "watch",
      "build",
      "--filter=./packages/*",
    ]);
  });
});
