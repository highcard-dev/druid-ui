import { createDFunc } from "./utils";

const dfunc =
  window.druid?.d ||
  (() => {
    throw new Error("druid.d function not defined");
  });

export const d = createDFunc(dfunc);
export { emit } from "./utils";
export { logfunc as log } from "../host-functions";
