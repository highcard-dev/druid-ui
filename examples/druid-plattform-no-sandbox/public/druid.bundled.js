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

// ../../packages/plattform/dist/index.js
var { request: requestRaw, loadFileFromDeployment: loadFileFromDeploymentRaw, saveFileToDeployment: saveFileToDeploymentRaw } = window["druid-extension"]["druid:ui/plattform"];
var request = rawAsyncToPromise(requestRaw);
var loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);
var saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);

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

// src/component/druid.tsx
var i = 0;
var config = {};
var CONFIG_FILENAME = "server.properties.scroll_template";
var MainComponent = {
  init: async () => {
    log2("hallo");
    try {
      const data = await loadFileFromDeployment(CONFIG_FILENAME);
      log2("test");
      log2(data);
      const content = data.split("\n");
      for (const line of content) {
        const parsedLine = line.split("=");
        if (parsedLine.length < 2) {
          continue;
        }
        const [property, value] = parsedLine;
        config[property] = value;
      }
    } catch (e) {
      log2(e);
    }
  },
  view: () => {
    log2("render main component");
    return /* @__PURE__ */ jsx("div", { children: Object.entries(config).map(([property, value]) => {
      return /* @__PURE__ */ jsx(ComponentTitle, { property, value });
    }) });
  }
};
var ComponentTitle = {
  view: ({ property, value }) => /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs("label", { children: [
    property,
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "text",
        value,
        onInput: (e) => {
          config[property] = e.value();
        }
      }
    )
  ] }) })
};
var component = createComponent((ctx) => {
  log2(`Init called with path: ${ctx.path}`);
  log2(JSON.stringify(config));
  if (ctx.path == "/test") {
    return /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("a", { href: "/", children: "go back" }),
      "Hallo Marc"
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(MainComponent, {}) }),
    /* @__PURE__ */ jsxs("main", { children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: async (e) => {
            const data = await loadFileFromDeployment(
              CONFIG_FILENAME
            );
            log2("test");
            log2(data);
          },
          children: "Do click123"
        }
      ),
      /* @__PURE__ */ jsx("hr", {}),
      /* @__PURE__ */ jsx("b", { children: "Clicks: " }),
      " ",
      i,
      i > 5 ? /* @__PURE__ */ jsx("div", { children: "more than 6 clicks!" }) : ""
    ] }),
    /* @__PURE__ */ jsx("a", { href: "/test", children: "go to test page" })
  ] });
});
export {
  component
};
