// node_modules/@druid-ui/component/dist/index.js
import { d as dfunc } from "druid:ui/ui";
import { log, rerender, setHook } from "druid:ui/ui";
import { Event } from "druid:ui/utils";
import { log as log2 } from "druid:ui/ui";
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
var createComponent = (j) => ({
  init: (ctx) => j(ctx),
  emit,
  asyncComplete: asyncCallback
});
var d2 = createDFunc(dfunc);

// node_modules/@druid-ui/component/dist/jsx-runtime.js
function jsx(type, props) {
  const { children, ...rest } = props || {};
  if (children !== void 0) {
    return d2(type, rest, children);
  }
  return d2(type, rest);
}
var jsxs = jsx;
var Fragment = Symbol.for("react.fragment");

// src/component/simple.tsx
var i = 0;
var ComponentTitle = ({ title, description }) => /* @__PURE__ */ jsxs("div", { children: [
  /* @__PURE__ */ jsx("h1", { children: title }),
  /* @__PURE__ */ jsx("h2", { children: description })
] });
var ComponentTitle2 = () => {
  return {
    view: ({ title, description }) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h1", { children: title }),
      /* @__PURE__ */ jsx("h2", { children: description })
    ] })
  };
};
var component = createComponent((ctx) => {
  log2(`Init called with path: ${ctx.path}`);
  if (ctx.path == "/test") {
    return /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("a", { href: "/", children: "go back" }),
      "Test path reached"
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(
      ComponentTitle,
      {
        title: "Hello World",
        description: "Just a simple component"
      }
    ),
    /* @__PURE__ */ jsx(
      ComponentTitle2,
      {
        title: "Hello World2",
        description: "Just a simple component 2"
      }
    ),
    /* @__PURE__ */ jsxs("main", { children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: (e) => {
            i++;
            log2(`Button clicked ${i} times at path: ${ctx.path}`);
          },
          children: "Do click"
        }
      ),
      /* @__PURE__ */ jsx("hr", {}),
      /* @__PURE__ */ jsx("b", { children: "Clicks: " }),
      " ",
      i,
      i > 5 ? /* @__PURE__ */ jsx("div", { children: "more than 5 clicks!" }) : ""
    ] }),
    /* @__PURE__ */ jsx("a", { href: "/test", children: "go to test page" })
  ] });
});
export {
  component
};
