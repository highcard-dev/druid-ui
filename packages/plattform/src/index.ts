/// <reference types="./types/druid-plattform.d.ts" />
/// <reference types="@druid-ui/component/jsx" />
import {
  request as requestRaw,
  loadFileFromDeployment as loadFileFromDeploymentRaw,
  saveFileToDeployment as saveFileToDeploymentRaw,
} from "druid:ui/plattform";
// it is very imporant that this is external, as druid-ui/component contains
// functions that must be important and cannot just be copied in again
// otherwise promises defined here will not resolve
import { rawAsyncToPromise } from "@druid-ui/component";

export const request = rawAsyncToPromise(requestRaw);

export const loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);

export const saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);
