//this file fully works in the browser, this hopefully can be remvoved in the future and unified with
import { createDFunc } from "./utils";

const dfunc =
  window["druid-ui"]?.d ||
  (() => {
    throw new Error("druid.d function not defined");
  });

export const d = createDFunc(dfunc);

export const log = (msg: string) => console.log("UI LOG:", msg);

export { createComponent, rawAsyncToPromise } from "./utils";
