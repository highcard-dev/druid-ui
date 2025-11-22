/// <reference types="./types/druid-plattform.d.ts" />
/// <reference types="../component/jsx.d.ts" />
import { request as requestRaw } from "druid:ui/plattform";
import { rawAsyncToPromise } from "../../src/component/utils";

export const request = rawAsyncToPromise(requestRaw);
