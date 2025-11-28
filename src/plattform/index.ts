/// <reference types="./types/druid-plattform.d.ts" />
/// <reference types="../component/jsx.d.ts" />
import {
  request as requestRaw,
  loadFileFromDeployment as loadFileFromDeploymentRaw,
  saveFileToDeployment as saveFileToDeploymentRaw,
} from "druid:ui/plattform";
import { rawAsyncToPromise } from "../../src/component/utils";

export const request = rawAsyncToPromise(requestRaw);

export const loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);

export const saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);
