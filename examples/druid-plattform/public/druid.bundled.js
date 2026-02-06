// ../../packages/component/dist/index.js
import { d as dfunc } from "druid:ui/ui";
import { log, rerender, setHook } from "druid:ui/ui";
import { Event } from "druid:ui/utils";
import { log as log2 } from "druid:ui/ui";
var callbackMap = {};
function emit(nodeid, event, e) {
  log(`Emit called for nodeid: ${nodeid}, event: ${event}`);
  const callbacks = callbackMap[nodeid];
  callbacks?.[event]?.(e);
}
var registerHooks = (id, fnresult) => {
  switch (true) {
    case !!fnresult.init:
      setHook(id, "init");
      callbackMap[id] = {
        ...callbackMap[id],
        init: fnresult.init
      };
      break;
  }
};
var createDFunc = (dfunc2) => {
  return (tag, props, ...children) => {
    children = children.flat();
    if (typeof tag !== "string") {
      if (typeof tag === "function") {
        const fnresult = tag(props);
        if (fnresult?.view) {
          const id3 = fnresult.view(props);
          registerHooks(id3, fnresult);
          return id3;
        } else {
          return tag(props);
        }
      }
      const id2 = tag.view(props);
      registerHooks(id2, tag);
      return id2;
    }
    const ps = { prop: [], on: [] };
    const cbObj = {};
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value instanceof Function) {
          const eventKey = key.startsWith("on") ? key.slice(2).toLowerCase() : key;
          cbObj[eventKey] = value;
          ps.on.push(eventKey);
        } else {
          if (typeof value === "boolean") {
            if (value) {
              ps.prop.push({ key, value: "true" });
            }
            continue;
          }
          ps.prop.push({ key, value });
        }
      }
    }
    const id = dfunc2(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => c?.toString()),
      {}
    );
    callbackMap[id] = {
      ...callbackMap[id],
      ...cbObj
    };
    return id;
  };
};
var pendingOperations = /* @__PURE__ */ new Map();
var asyncCallback = (id, result) => {
  log(`Async callback received for id: ${id} with result: ${result.tag}`);
  const pending = pendingOperations.get(id);
  if (pending) {
    if (result.tag === "ok") {
      pending.resolve(result.val);
    } else {
      pending.reject(new Error(result.val));
    }
    pendingOperations.delete(id);
    rerender();
  }
};
var rawAsyncToPromise = (fn) => (...args) => {
  return new Promise((resolve, reject) => {
    const asyncId = fn(...args);
    pendingOperations.set(asyncId, { resolve, reject });
  });
};
var createComponent = (j) => ({
  init: (ctx) => j(ctx),
  emit,
  asyncComplete: asyncCallback
});
var d2 = createDFunc(dfunc);

// ../../packages/plattform/dist/index.js
import {
  request as requestRaw,
  loadFileFromDeployment as loadFileFromDeploymentRaw,
  saveFileToDeployment as saveFileToDeploymentRaw
} from "druid:ui/plattform";
var request = rawAsyncToPromise(requestRaw);
var loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);
var saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);

// src/component/druid.tsx
var content = "test";
var component = createComponent((ctx) => {
  log2("Druid Plattform Component");
  return /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2(
    "button",
    {
      onClick: async () => {
        content = await loadFileFromDeployment("url");
      }
    },
    "request"
  ), /* @__PURE__ */ d2("div", null, content));
});
export {
  component
};
