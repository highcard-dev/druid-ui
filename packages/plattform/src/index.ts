/// <reference types="./types/druid-plattform.d.ts" />
/// <reference types="@druid-ui/component/jsx" />
import {
  request as requestRaw,
  loadFileFromDeployment as loadFileFromDeploymentRaw,
  saveFileToDeployment as saveFileToDeploymentRaw,
  ensureFileService as ensureFileServiceRaw,
  addAndRunCommand as addAndRunCommandRaw,
  stopCommand as stopCommandRaw,
} from "druid:ui/plattform";
import type { CommandInstruction as RawCommandInstruction } from "druid:ui/plattform";
// it is very imporant that this is external, as druid-ui/component contains
// functions that must be important and cannot just be copied in again
// otherwise promises defined here will not resolve
import { rawAsyncToPromise } from "@druid-ui/component";

export const request = rawAsyncToPromise(requestRaw);

export const loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);

export const saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);

export type CommandRunMode = "always" | "once" | "restart" | "persistent";
export type ProcedureType = "container" | "signal";

export interface CommandMount {
  path: string;
  subPath: string;
  readOnly: boolean;
}

export interface CommandExpectedPort {
  name: string;
  keepAliveTraffic: string;
}

export interface CommandProcedure {
  type?: ProcedureType;
  id?: string;
  ignoreFailure?: boolean;
  image?: string;
  command?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  expectedPorts?: CommandExpectedPort[];
  mounts?: CommandMount[];
  target?: string;
  signal?: string;
  tty?: boolean;
}

export interface CommandInstruction {
  procedures: CommandProcedure[];
  needs?: string[];
  run?: CommandRunMode;
}

const toRawCommandInstruction = (command: CommandInstruction): RawCommandInstruction => ({
  run: command.run ?? "always",
  needs: command.needs ?? [],
  procedures: command.procedures.map((procedure) => ({
    procedureType: procedure.type ?? "container",
    ...(procedure.id === undefined ? {} : { id: procedure.id }),
    ignoreFailure: procedure.ignoreFailure ?? false,
    image: procedure.image ?? "",
    command: procedure.command ?? [],
    workingDir: procedure.workingDir ?? "",
    env: Object.entries(procedure.env ?? {}),
    expectedPorts: procedure.expectedPorts ?? [],
    mounts: procedure.mounts ?? [],
    target: procedure.target ?? "",
    signal: procedure.signal ?? "",
    tty: procedure.tty ?? false,
  })),
});

export const ensureFileService = (watch = false): Promise<void> =>
  rawAsyncToPromise(ensureFileServiceRaw)(watch).then(() => undefined);

export const addAndRunCommand = (name: string, command: CommandInstruction): Promise<void> =>
  rawAsyncToPromise(addAndRunCommandRaw)(name, toRawCommandInstruction(command)).then(() => undefined);

export const stopCommand = (name: string): Promise<void> => rawAsyncToPromise(stopCommandRaw)(name).then(() => undefined);
