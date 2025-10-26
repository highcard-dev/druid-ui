// src/component/ui.ts
import { d as dfunc } from "docs:adder/ui";
import { log } from "docs:adder/ui";
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
  log(tag.toString());
  if (typeof tag !== "string") {
    log("Rendering component via its view method");
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
  log(`1: Emitting event ${event} for node ${nodeid}`);
  const callbacks = eventMap[nodeid];
  log(`2: Emitting event ${event} for node ${nodeid}`);
  callbacks?.[event]?.(e);
}

// src/component/adder.tsx
import { log as log2 } from "docs:adder/ui";
var Ev = class {
  constructor(_value = "", _checked = false) {
    this._value = _value;
    this._checked = _checked;
    log2(`Event created with value: ${this._value}, checked: ${this._checked}`);
  }
  preventDefault() {
    log2("preventDefault called");
  }
  stopPropagation() {
    log2("stopPropagation called");
  }
  value() {
    return this._value;
  }
  checked() {
    return this._checked;
  }
};
var i = 0;
var ComponentV2 = {
  view: ({ title, description }) => /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("h1", null, title), /* @__PURE__ */ d("h2", null, description))
};
var ComponentV3 = ({ title, description }) => /* @__PURE__ */ d("div", null, /* @__PURE__ */ d("h1", null, title), /* @__PURE__ */ d("h2", null, description));
var initcomponent = {
  init: () => {
    return /* @__PURE__ */ d("div", { class: "hello" }, /* @__PURE__ */ d("h2", null, "lol"), /* @__PURE__ */ d("main", null, "wuuuu", /* @__PURE__ */ d("div", null, "fuckme"), /* @__PURE__ */ d(
      "input",
      {
        type: "text",
        onChange: (e) => log2(`Input changed: ${e.value()}`)
      }
    ), /* @__PURE__ */ d(
      "button",
      {
        onClick: (e) => {
          i++;
          log2("Button clicked!");
          log2(`Event value: ${e.value()}`);
          log2(`Event checked: ${e.checked()}`);
          log2(`Button clicked ${i} times`);
        }
      },
      "test"
    ), "uut!!", i, /* @__PURE__ */ d(ComponentV2, { title: "This is it!1", description: "newschool1" }), /* @__PURE__ */ d(ComponentV3, { title: "This is it!2", description: "newschool2" })), "Hello!");
  },
  emit: (nodeid, event, e) => {
    log2(`Emitting event ${event} for node ${nodeid}`);
    return emit(nodeid, event, e);
  },
  Event: Ev
};
export {
  initcomponent
};
