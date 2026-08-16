// ../../packages/component/dist/index.js
import { d as dfunc } from "druid:ui/ui";
import { log, rerender, setHook } from "druid:ui/ui";
import { Event } from "druid:ui/utils";
import { log as log2, rerender as rerender2 } from "druid:ui/ui";
var createAsyncBridge = (onSettled = () => void 0, trace = () => void 0) => {
  const pending = /* @__PURE__ */ new Map();
  const early = /* @__PURE__ */ new Map();
  const settle = (operation, result) => {
    if (result.tag === "ok") operation.resolve(result.val);
    else operation.reject(new Error(String(result.val)));
    onSettled();
  };
  const complete = (id, result) => {
    trace(`Async callback received for id: ${id} with result: ${result.tag}`);
    const operation = pending.get(id);
    if (!operation) {
      early.set(id, result);
      return;
    }
    pending.delete(id);
    settle(operation, result);
  };
  const wrap = (fn) => (...args) => new Promise((resolve, reject) => {
    const id = fn(...args);
    const operation = {
      resolve: (value) => resolve(value),
      reject
    };
    const earlyResult = early.get(id);
    if (earlyResult) {
      early.delete(id);
      settle(operation, earlyResult);
      return;
    }
    pending.set(id, operation);
  });
  return { complete, wrap };
};
var lowerPropertyValue = (value) => value === void 0 || value === null ? void 0 : String(value);
var callbackMap = {};
function emit(nodeid, event, e) {
  log(`Emit called for nodeid: ${nodeid}, event: ${event}`);
  const callbacks = callbackMap[nodeid];
  const result = callbacks?.[event]?.(e);
  if (result instanceof Promise) {
    result.then(() => rerender());
  }
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
          const loweredValue = lowerPropertyValue(value);
          if (loweredValue === void 0) continue;
          if (typeof value === "boolean") {
            ps.prop.push({ key, value: loweredValue });
            continue;
          }
          ps.prop.push({ key, value: loweredValue });
        }
      }
    }
    const id = dfunc2(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => String(c))
    );
    callbackMap[id] = {
      ...callbackMap[id],
      ...cbObj
    };
    return id;
  };
};
var asyncBridge = createAsyncBridge(
  () => rerender(),
  (message) => log(message)
);
var asyncCallback = asyncBridge.complete;
var rawAsyncToPromise = asyncBridge.wrap;
var createComponent = (j) => ({
  init: (ctx) => j(ctx),
  emit,
  asyncComplete: asyncCallback
});
var d2 = createDFunc(dfunc);

// src/component/extended.tsx
import { requestGet } from "druid:ui/extension";

// ../../packages/component/dist/jsx-runtime.js
function jsx(type, props) {
  const { children, ...rest } = props || {};
  if (children !== void 0) {
    return d2(type, rest, children);
  }
  return d2(type, rest);
}
var jsxs = jsx;
var Fragment = Symbol.for("react.fragment");

// src/component/extended.tsx
var done = false;
var disabled = false;
var content = "";
var url = "https://api.github.com/";
var component = createComponent(() => {
  if (!done) {
    done = true;
  }
  return /* @__PURE__ */ jsxs("div", { class: "hello", children: [
    /* @__PURE__ */ jsx("h2", { children: "Hello!" }),
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "text",
        value: url,
        onKeyUp: (e) => {
          url = e.value();
        }
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        disabled: disabled ? "true" : "",
        onClick: (e) => {
          disabled = true;
          rawAsyncToPromise(requestGet)("https://api.github.com/").then((data) => {
            log2("Fetched data:" + data);
            content = data;
          }).finally(() => {
            log2("Fetch operation completed");
            disabled = false;
          });
          e.preventDefault();
        },
        children: "Click me"
      }
    ),
    !!content && /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("hr", {}),
      /* @__PURE__ */ jsx("h2", { children: "Content" }),
      /* @__PURE__ */ jsx("pre", { children: content })
    ] })
  ] });
});
export {
  component
};
