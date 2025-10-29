// src/component/adder.tsx
import { log } from "druid:ui/ui";

// ../../src/component/index.ts
import "druid:ui/utils";
import { d as dfunc } from "druid:ui/ui";
var eventMap = {};
function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i2 = 0; i2 < str.length; i2++) {
    hash ^= str.charCodeAt(i2);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}
function d(tag, props, ...children) {
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
        ps.prop.push({ key, value });
      }
    }
  }
  return dfunc(
    tag,
    ps,
    children.map((c) => c.toString())
  );
}
function emit(nodeid, event, e) {
  const callbacks = eventMap[nodeid];
  callbacks?.[event]?.(e);
}

// src/component/adder.tsx
var i = 0;
var ComponentV2 = {
  view: ({ title, description }) => /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("h1", null, title), /* @__PURE__ */ d("h2", null, description))
};
var ComponentV3 = ({ title, description }) => /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("h1", null, title), /* @__PURE__ */ d("h2", null, description));
var component = {
  init: (ctx) => {
    log(`Init called with path: ${ctx.path}`);
    if (ctx.path == "/test") {
      return /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("a", { href: "/" }, "go back"), "Test path reached!");
    }
    return /* @__PURE__ */ d("div", { class: "hello" }, /* @__PURE__ */ d("h2", null, "lol"), /* @__PURE__ */ d("main", null, "I can give you speed!", /* @__PURE__ */ d("div", null, "MM\u2764\uFE0F"), /* @__PURE__ */ d(
      "input",
      {
        type: "text",
        onChange: (e) => log(`Input changed: ${e.value()}`)
      }
    ), /* @__PURE__ */ d(
      "button",
      {
        onClick: (e) => {
          i++;
        }
      },
      "test"
    ), "uut!!", i, /* @__PURE__ */ d(ComponentV2, { title: "This is it!", description: "newschool" }), /* @__PURE__ */ d(ComponentV3, { title: "This is it!", description: "newschool" }), i > 5 && /* @__PURE__ */ d("div", null, "more than 5 clicks!")), /* @__PURE__ */ d("a", { href: "/test" }, "go to test"), "Hello!");
  },
  emit: (nodeid, event, e) => {
    log(`Emitting event ${event} for node ${nodeid}`);
    return emit(nodeid, event, e);
  }
};
export {
  component
};
