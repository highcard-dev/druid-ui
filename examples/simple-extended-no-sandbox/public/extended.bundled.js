// ../../packages/component/dist/index.js
var { d: dfunc } = window["druid-extension"]["druid:ui/ui"];
var { log, rerender, setHook } = window["druid-extension"]["druid:ui/ui"];
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
var createDFunc = (dfunc22) => {
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
    const id = dfunc22(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => c?.toString())
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
var { Event } = window["druid-extension"]["druid:ui/utils"];
var { log: log2 } = window["druid-extension"]["druid:ui/ui"];
var d2 = createDFunc(dfunc);

// ../../packages/component/dist/jsx-runtime.js
var { d: dfunc2 } = window["druid-extension"]["druid:ui/ui"];
var { log: log3, rerender: rerender2, setHook: setHook2 } = window["druid-extension"]["druid:ui/ui"];
var callbackMap2 = {};
var registerHooks2 = (id, fnresult) => {
  switch (true) {
    case !!fnresult.init:
      setHook2(id, "init");
      callbackMap2[id] = {
        ...callbackMap2[id],
        init: fnresult.init
      };
      break;
  }
};
var createDFunc2 = (dfunc22) => {
  return (tag, props, ...children) => {
    children = children.flat();
    if (typeof tag !== "string") {
      if (typeof tag === "function") {
        const fnresult = tag(props);
        if (fnresult?.view) {
          const id3 = fnresult.view(props);
          registerHooks2(id3, fnresult);
          return id3;
        } else {
          return tag(props);
        }
      }
      const id2 = tag.view(props);
      registerHooks2(id2, tag);
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
    const id = dfunc22(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => c?.toString())
    );
    callbackMap2[id] = {
      ...callbackMap2[id],
      ...cbObj
    };
    return id;
  };
};
var { Event: Event2 } = window["druid-extension"]["druid:ui/utils"];
var { log: log22 } = window["druid-extension"]["druid:ui/ui"];
var d22 = createDFunc2(dfunc2);
function jsx(type, props) {
  const { children, ...rest } = props || {};
  if (children !== void 0) {
    return d22(type, rest, children);
  }
  return d22(type, rest);
}
var jsxs = jsx;
var Fragment = Symbol.for("react.fragment");

// public/extended.tsx
var { requestGet } = window["druid-extension"]["druid:ui/extension"];
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
