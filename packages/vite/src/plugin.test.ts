// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildRaw: vi.fn(async () => undefined),
  glob: vi.fn(async () => [
    "src/app.tsx",
    "../../packages/config-editor/src/copy.ts",
  ]),
}));

vi.mock("@druid-ui/build", () => ({
  buildRaw: mocks.buildRaw,
  buildWasm: vi.fn(async () => undefined),
}));
vi.mock("tinyglobby", () => ({ glob: mocks.glob }));

import { ViteHMRPlugin } from "./plugin.js";

describe("ViteHMRPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers component and dependency files with the dev-server watcher", async () => {
    const plugin = ViteHMRPlugin("src/app.tsx", "raw", undefined, [
      "../../packages/config-editor/src/**/*.{ts,tsx}",
    ]) as {
      configureServer(server: unknown): Promise<void>;
    };
    const add = vi.fn();
    await plugin.configureServer({
      watcher: { add },
      middlewares: { use: vi.fn() },
      ws: { send: vi.fn() },
    });

    expect(mocks.glob).toHaveBeenCalledWith([
      "src/app.tsx",
      "../../packages/config-editor/src/**/*.{ts,tsx}",
    ]);
    expect(add).toHaveBeenCalledWith([
      "src/app.tsx",
      "../../packages/config-editor/src/copy.ts",
    ]);
    expect(mocks.buildRaw).toHaveBeenCalledWith("src/app.tsx", "public");
  });
});
