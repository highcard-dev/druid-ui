import { type LuaEngine, LuaFactory } from "wasmoon";
import type { Component, FENode, Props, Routes } from "./types";
import morphdom from "morphdom";
import { dfunc } from "./util.js";

export type rerenderFn = () => void;

const allowedProps = ["onclick", "onkeyup"] as Array<keyof HTMLElement>;

function updateEvents(fromEl: any, toEl: any) {
  var i, eventPropName;
  for (i = 0; i < allowedProps.length; i++) {
    eventPropName = allowedProps[i] as string;
    if (fromEl[eventPropName] !== toEl[eventPropName]) {
      fromEl[eventPropName] = toEl[eventPropName];
    }
  }
}

export class DruidUI extends HTMLElement {
  private loadedRoutes?: Routes;
  private initElementList: Component[] = [];
  private elements: any;

  private shadow: ShadowRoot;
  private mountEl: HTMLElement;
  private lua?: LuaEngine;

  private currentPath: string;
  private externalRoute = false;

  get routes() {
    return this.getRoutes();
  }

  set colors(colors: Record<string, string>) {
    for (const [key, value] of Object.entries(colors)) {
      this.setCSSVariable("--color-" + key, value);
    }
  }

  static get observedAttributes() {
    return ["entrypoint", "path", "default-style"];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string
  ) {
    switch (name) {
      case "entrypoint":
        this.loadEntrypointFromUrl(newValue);
        break;
      case "path":
        this.externalRoute = newValue !== null;
        this.currentPath = newValue;
        if (oldValue) {
          this.rerender();
        }
        break;
    }
  }

  constructor() {
    super();
    this.currentPath = "/";
    this.shadow = this.attachShadow({ mode: "open" });

    this.mountEl = document.createElement("div");
    this.shadow.appendChild(this.mountEl);
  }

  async executeLuaRender(luaEntryoint: string) {
    this.lua?.global.set("mount", this.mountFn.bind(this));
    this.lua?.global.set("route", this.routeFn.bind(this));
    this.lua?.global.set("rerender", this.rerender.bind(this));
    this.lua?.global.set("df", dfunc);
    this.lua?.global.set("debug", console.log);
    this.lua?.global.set("json_encode", JSON.stringify);
    this.lua?.global.set("json_decode", JSON.parse);

    this.dispatchEvent(
      new CustomEvent("init", {
        detail: { lua: this.lua },
        bubbles: true,
        composed: true,
      })
    );
    try {
      await this.lua?.doString(`
    methods = {}
    dmethods = {}
    --iterate dmethods and set them as global functions
    for k, v in pairs(dmethods) do
        methods[k] = v
    end

    d = setmetatable({}, {
        __call = function(_, ...)
            return df(...)
        end,
        __index = methods
    })`);
      await this.lua?.doFile(luaEntryoint);
    } catch (e) {
      this.mountEl.innerHTML = `<pre class="underline">${e}</pre>`;
    }
  }

  setupEventListeners() {
    // Listen for popstate events
    window.addEventListener("popstate", () => {
      this.rerender();
    });
  }

  useComponent(component: Component) {
    if (!this.initElementList.includes(component)) {
      this.initElementList.push(component);
      component.oninit?.();
    }
    return component.view();
  }

  mountFn(component: Component) {
    this.setupEventListeners();
    this.loadedRoutes = {
      index: component,
      notfound: component,
    };
    this.rerender();
  }

  routeFn(component: Component, routes: Record<string, Component>) {
    this.setupEventListeners();
    this.loadedRoutes = {
      index: component,
      notfound: component,
      ...routes,
    };
    this.rerender();
  }

  setCurrentPath(path: string) {
    this.currentPath = path;
    this.rerender();
  }

  rerender() {
    if (!this.loadedRoutes) {
      throw new Error("Component not mounted");
    }

    const currentUrl = this.currentPath;

    let component: Component;
    if (currentUrl === "/") {
      component = this.loadedRoutes.index;
    } else if (this.loadedRoutes[currentUrl]) {
      component = this.loadedRoutes[currentUrl] as Component;
    } else {
      component = this.loadedRoutes.notfound;
    }

    // Start benchmarking
    const start = performance.now();

    // Helper to recursively build elements from FENodes or text strings.
    const createElementFromNode = (node: FENode | string): Element | Text => {
      // If the node is a simple text string, return a text node.
      if (typeof node === "string") {
        return document.createTextNode(node);
      }

      // Otherwise, use renderFunc to create the element.
      const el = this.createHtmlElement(node.selector, node.props, "");

      // If there are children, render them and append them to the current element.
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          const childEl = createElementFromNode(child);
          el.appendChild(childEl);
        });
      }
      return el;
    };

    // Get the FENode tree from the mounted component’s view.
    // (Assumes that the component returns a valid FENode tree or a string.)

    const tree = this.useComponent(component) as unknown as FENode | string;
    if (!tree) {
      throw new Error("Tree is undefined");
    }
    const domTree = createElementFromNode(tree);

    if (!this.elements) {
      this.mountEl.innerHTML = "";
      this.elements = domTree;
      this.mountEl.appendChild(domTree);
    } else {
      morphdom(this.elements, domTree, {
        onBeforeElUpdated: function (fromEl, toEl) {
          for (const key of ["style"] as Array<keyof HTMLElement>) {
            if (key === "style") {
              const s = fromEl.getAttribute("style");
              if (!s) {
                continue;
              }
              toEl.setAttribute("style", s);
              continue;
            }
          }

          updateEvents(fromEl, toEl);
          return true;
        },
      });
    }

    // End benchmarking
    const end = performance.now();
    console.log(`Rerender took ${end - start} milliseconds`);
  }
  async loadEntrypointFromUrl(luafile: string) {
    const factory = new LuaFactory();

    let luaEntryoint = luafile;

    if (luafile.endsWith(".json")) {
      const res = await fetch(luafile);
      const files = (await res.json()) as string[];
      const promises = files.map(async (file) => {
        const baseUrl = luafile.split("/").slice(0, -1).join("/");

        const res = await fetch(baseUrl + "/" + file);
        const content = await res.text();
        console.log("Mounting file", file);
        await factory.mountFile("./" + file, content);
      });
      if (files[0] === undefined) {
        throw new Error("No files found in the JSON");
      }
      luaEntryoint = files[0];
      await Promise.all(promises);
    } else if (luafile.endsWith(".lua")) {
      const res = await fetch(luafile);
      const content = await res.text();
      console.log("Mounting file", luafile);
      await factory.mountFile(luafile, content);
    } else {
      throw new Error(
        "Entrypoint must be a .json or .lua file. Got " + luafile
      );
    }

    this.lua = await factory.createEngine({
      injectObjects: true,
      enableProxy: true,
      functionTimeout: 1000,
      openStandardLibs: true,
      traceAllocations: true,
    });

    this.executeLuaRender(luaEntryoint);
  }

  private createHtmlElement(
    selector: string | Component,
    props: Props,
    content: string | string[]
  ) {
    if (typeof selector === "object") {
      return this.useComponent(selector);
    }

    let element, classes, id;

    if (selector.startsWith(".")) {
      [, ...classes] = selector.split(".");
      element = "div";
    } else {
      [element, ...classes] = selector.split(".");
    }
    [, id] = selector.split("#");

    switch (element) {
      case "Link":
        element = "a";

        if (this.externalRoute) {
          props["onclick"] = () => {
            this.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { route: props["to"] },
                bubbles: true,
                composed: true,
              })
            );
          };
          break;
        }

        props["onclick"] = () => {
          if (!props["to"]) {
            window.history.pushState({}, "", "/");
          } else {
            window.history.pushState({}, "", props["to"] as string);
          }
        };
        props["href"] = props["to"];
    }
    const el = document.createElement(element as string);
    if (id) {
      el.id = id;
    }

    if (classes.length) {
      el.classList.add(...classes);
    }

    for (const key of allowedProps) {
      const prop = props[key];
      if (prop && typeof prop === "function") {
        (el as any)[key] = (e: any) => {
          prop(e.target.value);
          this.rerender();
        };
      }
    }

    for (const key of ["href", "value"]) {
      let prop = props[key];
      if (prop) {
        if (key === "href") {
          prop = prop;
        }
        el.setAttribute(key, prop as string);
      }
    }

    if (Array.isArray(content)) {
      el.innerHTML = content.join("");
    } else if (content) {
      el.innerHTML = content;
    }
    return el;
  }
  getRoutes() {
    return this.loadedRoutes;
  }

  public setCSSVariable(variable: string, value: string): void {
    // Ensure the variable name starts with "--"
    if (!variable.startsWith("--")) {
      variable = "--" + variable;
    }
    this.mountEl.style.setProperty(variable, value);
  }
}

customElements.define("druid-ui", DruidUI);
