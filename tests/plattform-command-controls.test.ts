import { beforeEach, describe, expect, it, vi } from "vitest";

const { bridge, raw } = await vi.hoisted(async () => {
  const { createAsyncBridge } = await import("../packages/component/src/async");
  return {
    bridge: createAsyncBridge(),
    raw: {
      request: vi.fn(),
      loadFileFromDeployment: vi.fn(),
      saveFileToDeployment: vi.fn(),
      ensureFileService: vi.fn(),
      addAndRunCommand: vi.fn(),
      stopCommand: vi.fn(),
    },
  };
});

vi.mock("druid:ui/plattform", () => raw);
vi.mock("@druid-ui/component", () => ({ rawAsyncToPromise: bridge.wrap }));

import {
  addAndRunCommand,
  ensureFileService,
  stopCommand,
} from "../packages/plattform/src/index";

describe("platform command controls", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    raw.ensureFileService.mockReturnValue("ensure");
    raw.addAndRunCommand.mockReturnValue("run");
    raw.stopCommand.mockReturnValue("stop");
  });

  it("lowers omitted command options to WIT defaults without inventing an id", async () => {
    const result = addAndRunCommand("start", { procedures: [{}] });

    expect(raw.addAndRunCommand).toHaveBeenCalledWith("start", {
      run: "always",
      needs: [],
      procedures: [{
        procedureType: "container",
        ignoreFailure: false,
        image: "",
        command: [],
        workingDir: "",
        env: [],
        expectedPorts: [],
        mounts: [],
        target: "",
        signal: "",
        tty: false,
      }],
    });
    expect(raw.addAndRunCommand.mock.calls[0]?.[1].procedures[0]).not.toHaveProperty("id");
    bridge.complete("run", { tag: "ok", val: "host acknowledgement" });
    await expect(result).resolves.toBeUndefined();
  });

  it("preserves explicit options and converts environment records to WIT tuples", async () => {
    const procedure = {
      type: "signal" as const,
      id: "reload-config",
      ignoreFailure: true,
      image: "server:latest",
      command: ["reload", "--force"],
      workingDir: "/server",
      env: { MODE: "development", EMPTY: "" },
      expectedPorts: [{ name: "web", keepAliveTraffic: "http" }],
      mounts: [{ path: "/data", subPath: "world", readOnly: true }],
      target: "server",
      signal: "HUP",
      tty: true,
    };
    const result = addAndRunCommand("reload", {
      run: "restart",
      needs: ["install"],
      procedures: [procedure],
    });

    const { type, env, ...expectedProcedure } = procedure;
    expect(raw.addAndRunCommand).toHaveBeenCalledWith("reload", {
      run: "restart",
      needs: ["install"],
      procedures: [{
        ...expectedProcedure,
        procedureType: type,
        env: [["MODE", "development"], ["EMPTY", ""]],
      }],
    });
    expect(env).toEqual({ MODE: "development", EMPTY: "" });
    bridge.complete("run", { tag: "ok", val: null });
    await expect(result).resolves.toBeUndefined();
  });

  it.each([
    [undefined, false],
    [false, false],
    [true, true],
  ])("forwards watch=%s to the file service as %s", async (watch, expected) => {
    const result = watch === undefined ? ensureFileService() : ensureFileService(watch);
    expect(raw.ensureFileService).toHaveBeenCalledWith(expected);
    bridge.complete("ensure", { tag: "ok", val: "ready" });
    await expect(result).resolves.toBeUndefined();
  });

  it("forwards the exact command name when stopping", async () => {
    const result = stopCommand("custom command/name");
    expect(raw.stopCommand).toHaveBeenCalledWith("custom command/name");
    bridge.complete("stop", { tag: "ok", val: "stopped" });
    await expect(result).resolves.toBeUndefined();
  });

  it.each([
    ["ensure", () => ensureFileService()],
    ["run", () => addAndRunCommand("start", { procedures: [] })],
    ["stop", () => stopCommand("start")],
  ] as const)("propagates asynchronous host failures for %s", async (id, invoke) => {
    const result = invoke();
    const rejection = expect(result).rejects.toThrow("host rejected operation");
    bridge.complete(id, { tag: "err", val: "host rejected operation" });
    await rejection;
  });
});
