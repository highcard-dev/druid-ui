// ../../src/component/utils.ts
var { log, rerender, d, setHook } = window["druid-extension"]["druid:ui/ui"];
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

// ../../src/component/raw.ts
var dfunc = window["druid-ui"]?.d || (() => {
  throw new Error("druid.d function not defined");
});
var d2 = createDFunc(dfunc);
var log2 = (msg) => console.log("UI LOG:", msg);

// ../../src/plattform/index.ts
var { request: requestRaw, loadFileFromDeployment: loadFileFromDeploymentRaw, saveFileToDeployment: saveFileToDeploymentRaw } = window["druid-extension"]["druid:ui/plattform"];
var request = rawAsyncToPromise(requestRaw);
var loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);
var saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);

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
    return /* @__PURE__ */ d2("div", null, Object.entries(config).map(([property, value]) => {
      return /* @__PURE__ */ d2(ComponentTitle, { property, value });
    }));
  }
};
var ComponentTitle = {
  view: ({ property, value }) => /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2("label", null, property, /* @__PURE__ */ d2(
    "input",
    {
      type: "text",
      value,
      onInput: (e) => {
        config[property] = e.value();
      }
    }
  )))
};
var component = createComponent((ctx) => {
  log2(`Init called with path: ${ctx.path}`);
  log2(JSON.stringify(config));
  if (ctx.path == "/test") {
    return /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2("a", { href: "/" }, "go back"), "Hallo Marc");
  }
  return /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2(MainComponent, null)), /* @__PURE__ */ d2("main", null, /* @__PURE__ */ d2(
    "button",
    {
      onClick: async (e) => {
        const data = await loadFileFromDeployment(
          CONFIG_FILENAME
        );
        log2("test");
        log2(data);
      }
    },
    "Do click123"
  ), /* @__PURE__ */ d2("hr", null), /* @__PURE__ */ d2("b", null, "Clicks: "), " ", i, i > 5 ? /* @__PURE__ */ d2("div", null, "more than 6 clicks!") : ""), /* @__PURE__ */ d2("a", { href: "/test" }, "go to test page"));
});
export {
  component
};
