// ../../src/component/index.ts
import { d as dfunc } from "druid:ui/ui";

// ../../src/component/utils.ts
import { log, rerender } from "druid:ui/ui";
function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}
var eventMap = {};
function emit(nodeid, event, e) {
  log(`Emit called for nodeid: ${nodeid}, event: ${event}`);
  const callbacks = eventMap[nodeid];
  callbacks?.[event]?.(e);
}
var createDFunc = (dfunc2) => {
  return (tag, props, ...children) => {
    if (typeof tag !== "string") {
      if (typeof tag === "function") {
        return tag(props);
      }
      return tag.view(props);
    }
    const ps = { prop: [], on: [] };
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value instanceof Function) {
          const eventKey = key.startsWith("on") ? key.slice(2).toLowerCase() : key;
          const cbId = fnv1aHash(value.toString());
          eventMap[cbId] = eventMap[cbId] || {};
          eventMap[cbId][eventKey] = value;
          ps.on.push([eventKey, cbId]);
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
    return dfunc2(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => c.toString())
    );
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

// ../../src/component/index.ts
import { Event } from "druid:ui/utils";
import { log as log2 } from "druid:ui/ui";
var d = createDFunc(dfunc);

// src/component/extended.tsx
import { requestGet } from "druid:ui/extension";
var done = false;
var disabled = false;
var content = "";
var url = "https://api.github.com/";
var component = createComponent(() => {
  if (!done) {
    done = true;
  }
  return /* @__PURE__ */ d("div", { class: "hello" }, /* @__PURE__ */ d("h2", null, "Hello!"), /* @__PURE__ */ d(
    "input",
    {
      type: "text",
      value: url,
      onKeyUp: (e) => {
        url = e.value();
      }
    }
  ), /* @__PURE__ */ d(
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
      }
    },
    "Click me"
  ), !!content && /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("hr", null), /* @__PURE__ */ d("h2", null, "Content"), /* @__PURE__ */ d("pre", null, content)));
});
export {
  component
};
