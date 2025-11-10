import { d as dfunc } from "druid:ui/ui";
import { createDFunc, rawAsyncToPromise } from "./utils";
import { fetch as rawFetch } from "druid:ui/ui";

export { Event, type Context } from "druid:ui/utils";
export { log } from "druid:ui/ui";

export const d = createDFunc(dfunc);
export const fetch = rawAsyncToPromise<string>(rawFetch);
export { createComponent, rawAsyncToPromise } from "./utils";
