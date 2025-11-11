// ../../src/component/utils.ts
var { log, rerender } = window["druid-extension"]["druid:ui/ui"];
function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i2 = 0; i2 < str.length; i2++) {
    hash ^= str.charCodeAt(i2);
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
var createComponent = (j) => ({
  init: (ctx) => j(ctx),
  emit,
  asyncComplete: asyncCallback
});

// ../../src/component/raw.ts
var dfunc = window["druid-ui"]?.d || (() => {
  throw new Error("druid.d function not defined");
});
var d = createDFunc(dfunc);
var log2 = (msg) => console.log("UI LOG:", msg);

// public/simple.tsx
var i = 0;
var ComponentTitle = ({ title, description }) => /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("h1", null, title), /* @__PURE__ */ d("h2", null, description));
var component = createComponent((ctx) => {
  log2(`Init called with path: ${ctx.path}`);
  if (ctx.path == "/test") {
    return /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("a", { href: "/" }, "go back"), "Test path reached");
  }
  return /* @__PURE__ */ d("div", null, /* @__PURE__ */ d(
    ComponentTitle,
    {
      title: "Hello World",
      description: "Just a simple component"
    }
  ), /* @__PURE__ */ d("main", null, /* @__PURE__ */ d(
    "button",
    {
      onClick: (e) => {
        i++;
        log2(`Button clicked ${i} times at path: ${ctx.path}`);
      }
    },
    "Do click"
  ), /* @__PURE__ */ d("hr", null), /* @__PURE__ */ d("b", null, "Clicks: "), " ", i, i > 5 ? /* @__PURE__ */ d("div", null, "more than 5 clicks!") : ""), /* @__PURE__ */ d("a", { href: "/test" }, "go to test page"));
});
export {
  component
};
