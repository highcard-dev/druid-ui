import { createDFunc } from "./utils";

const dfunc = window.druid?.d;

export const d = createDFunc(dfunc);
export { emit } from "./utils";
export { logfunc as log } from "../host-functions";
