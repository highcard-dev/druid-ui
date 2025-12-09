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

// public/simple.tsx
var i = 0;
var ComponentTitle = {
  init: () => {
    log2("ComponentTitle init called");
  },
  view: ({ title, description }) => /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2("h1", null, title), /* @__PURE__ */ d2("h2", null, description))
};
var component = createComponent((ctx) => {
  log2(`Init called with path: ${ctx.path}`);
  if (ctx.path == "/test") {
    return /* @__PURE__ */ d2("div", null, /* @__PURE__ */ d2("a", { href: "/" }, "go back"), "Test path reached");
  }
  return /* @__PURE__ */ d2("div", null, ["1", "2", "3"].map((val) => /* @__PURE__ */ d2("div", null, val)), /* @__PURE__ */ d2(
    ComponentTitle,
    {
      title: "Hello World",
      description: "Just a simple component"
    }
  ), /* @__PURE__ */ d2("main", null, /* @__PURE__ */ d2(
    "button",
    {
      onClick: (e) => {
        i++;
        log2(`Button clicked ${i} times at path: ${ctx.path}`);
      }
    },
    "Do click"
  ), /* @__PURE__ */ d2("hr", null), /* @__PURE__ */ d2("b", null, "Clicks: "), " ", i, i > 5 ? /* @__PURE__ */ d2("div", null, "more than 5 clicks!") : ""), /* @__PURE__ */ d2("a", { href: "/test" }, "go to test page"));
});
export {
  component
};
