import { d as dfunc } from "druid:ui/ui";
import { createDFunc } from "./utils";

export const d = createDFunc(dfunc);

export { emit } from "./utils";

export { Event, type Context } from "druid:ui/utils";
export { log } from "druid:ui/ui";
