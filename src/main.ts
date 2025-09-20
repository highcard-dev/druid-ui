import { type LuaEngine, LuaFactory } from "wasmoon";
import type { Component, FENode, Props, Routes } from "./types";
import morphdom from "morphdom";
import { dfunc } from "./util.js";
import { HttpFileLoader } from "./file-loader";
import { createRoutingStrategy } from "./routing-strategy";

export type RerenderFn = () => void;

const allowedProps = [
  "onclick",
  "onkeyup",
  "onchange",
  "ontoggle",
  "type",
] as Array<keyof HTMLElement>;

function updateEvents(fromEl: any, toEl: any) {
  var i, eventPropName;
  for (i = 0; i < allowedProps.length; i++) {
    eventPropName = allowedProps[i] as string;
    if (fromEl[eventPropName] !== toEl[eventPropName]) {
      fromEl[eventPropName] = toEl[eventPropName];
    }
  }
}

const factory = new LuaFactory();

export class DruidUI extends HTMLElement {
  private loadedRoutes?: Routes;
  private initElementList: Component[] = [];
  private elements: any;

  private shadow: ShadowRoot;
  private mountEl: HTMLElement;
  private lua?: LuaEngine;

  private routingStrategy = createRoutingStrategy("history");

  private luaEntryoint: string | undefined;

  private profile = false;

  private fileLoader = new HttpFileLoader();

  get routes() {
    return this.getRoutes();
  }

  set colors(colors: Record<string, string>) {
    for (const [key, value] of Object.entries(colors)) {
      this.setCSSVariable("--color-" + key, value);
    }
  }

  set fileloader(loader: HttpFileLoader) {
    this.fileLoader = loader;
  }

  static get observedAttributes() {
    return [
      "entrypoint",
      "path",
      "default-style",
      "profile",
      "css",
      "style",
      "fileloader",
      "routing-strategy",
    ];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string
  ) {
    switch (name) {
      case "entrypoint":
        this.luaEntryoint = newValue;
        this.loadEntrypointFromUrl(newValue);
        break;
      case "path":
        if (oldValue) {
          this.rerender();
        }
        break;
      case "profile":
        this.profile = newValue === "true";
        break;
      case "style":
        const htmlString = newValue;
        const styleEl = document.createElement("style");
        styleEl.textContent = htmlString.trim();

        // Insert style after all link elements
        const lastLink = Array.from(
          this.shadow.querySelectorAll('link[rel="stylesheet"]')
        ).pop();
        if (lastLink) {
          this.shadow.insertBefore(styleEl, lastLink.nextSibling);
        } else {
          this.shadow.insertBefore(
            styleEl,
            this.shadowRoot?.firstChild || null
          );
        }
        break;
      case "css":
        const css = newValue.split(",");
        //clear previous css links
        const existingLinks = this.shadow.querySelectorAll(
          'link[rel="stylesheet"]'
        );
        existingLinks.forEach((link) => link.remove());

        for (const comp of css) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = comp;
          this.shadow.insertBefore(link, this.shadowRoot?.firstChild || null);
        }
        break;
      case "routing-strategy":
        this.routingStrategy = createRoutingStrategy(
          newValue as "history" | "custom"
        );
        break;
    }
  }

  constructor() {
    super();

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
      /*
          const tableIndex = e.global.getTop() + 1;
    e.global.lua.lua_createtable(e.global.address, 0, 1);

    e.global.pushValue('request');
    e.global.pushValue((t, t2) => {
      console.log('requesting', t, t2);
    });
    e.global.lua.lua_settable(e.global.address, tableIndex);

    // Create the metatable
    const metaIndex = e.global.getTop() + 1;
    e.global.lua.lua_createtable(e.global.address, 0, 0);

    // Set __call metamethod
    e.global.pushValue('__call');
    e.global.pushValue(function (self, arg1, arg2, arg3) {
      console.log('rendering' + arg1, arg2, arg3);
    });
    e.global.lua.lua_settable(e.global.address, metaIndex);

    e.global.lua.lua_setmetatable(e.global.address, tableIndex);

    // Set the table as a global named 'test'
    e.global.lua.lua_setglobal(e.global.address, 'test');

    e.doStringSync('test.request("test", "test2", "test3")');

    e.doStringSync('test("testa", "test2a", "test3a")');
*/
      await this.lua?.doString(`
    methods = {}
    if dmethods then
        for k, v in pairs(dmethods) do
            methods[k] = v
        end
    end

    d = setmetatable({}, {
        __call = function(_, ...)
            return df(...)
        end,
        __index = methods
    })`);
      await this.lua?.doFile(luaEntryoint);

      this.dispatchEvent(
        new CustomEvent("mount", {
          detail: { lua: this.lua },
          bubbles: true,
          composed: true,
        })
      );
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

  useComponent(component: Component, props: any = {}): Element | Text {
    if (!this.initElementList.includes(component)) {
      this.initElementList.push(component);
      component.oninit?.();
    }
    return component.view(props);
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

  rerender() {
    if (!this.loadedRoutes) {
      throw new Error("Component not mounted");
    }

    const currentUrl = this.routingStrategy.getCurrentPath();
    console.log("Current URL:", currentUrl);
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
    if (this.profile) {
      console.log(`Rerender took ${end - start} milliseconds`);
    }
  }
  async loadEntrypointFromUrl(luafile: string) {
    try {
      if (this.profile) {
        console.log("Loading entrypoint from URL:", luafile);
      }

      let luaEntryoint = luafile;

      if (luafile.endsWith(".json")) {
        const res = await this.fileLoader.load(luafile);
        const files = JSON.parse(res) as string[];
        const promises = files.map(async (file) => {
          const baseUrl = luafile.split("/").slice(0, -1).join("/");

          try {
            const content = await this.fileLoader.load(baseUrl + "/" + file);
            if (this.profile) {
              console.log("Mounting file", file);
            }
            await factory.mountFile("./" + file, content);
          } catch (error) {
            console.warn(`Failed to load file ${file}:`, error);
            // Continue with other files even if one fails
          }
        });
        if (files[0] === undefined) {
          throw new Error("No files found in the JSON");
        }
        luaEntryoint = files[0];
        await Promise.allSettled(promises);
      } else if (luafile.endsWith(".lua")) {
        const content = await this.fileLoader.load(luafile);
        if (this.profile) {
          console.log("Mounting file", luafile);
        }
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
    } catch (error) {
      console.error("Failed to load entrypoint:", error);
      this.mountEl.innerHTML = `<div class="error">Failed to load: ${error}</div>`;
    }
  }

  public async reload(file: string) {
    try {
      const content = await this.fileLoader.load(file);

      await factory.mountFile(file, content);

      this.lua = await factory.createEngine({
        injectObjects: true,
        enableProxy: true,
        functionTimeout: 1000,
        openStandardLibs: true,
        traceAllocations: true,
      });
      if (!this.luaEntryoint) {
        throw new Error("No entrypoint set");
      }
      await this.executeLuaRender(this.luaEntryoint);
    } catch (error) {
      console.error("Failed to reload file:", error);
      this.mountEl.innerHTML = `<div class="error">Failed to reload: ${error}</div>`;
    }
  }

  private createHtmlElement(
    selector: string | Component,
    props: Props,
    content: string | string[]
  ) {
    if (typeof selector === "object") {
      return this.useComponent(selector, props);
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

        props["onclick"] = () => {
          if (!props["to"]) {
            this.routingStrategy.navigateTo("/");
          } else {
            this.routingStrategy.navigateTo(props["to"] as string);
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

    for (const key of [
      "href",
      "value",
      "type",
      "placeholder",
      "role",
      "checked",
      "id",
      "for",
      "selected",
      "open",
      "name",
    ]) {
      let prop = props[key];
      if (prop) {
        if (key === "href") {
          prop = prop;
        }
        el.setAttribute(key, prop as string);
      }
    }
    for (const key of allowedProps) {
      const prop = props[key];
      if (prop && typeof prop === "function") {
        (el as any)[key] = (e: any) => {
          e.preventDefault();
          prop({
            value: e.target.value,
            checked: e.target.checked,
            preventDefault: e.preventDefault.bind(e),
            stopPropagation: e.stopPropagation.bind(e),
            preventBubble: e.preventBubble.bind(e),
          });
          this.rerender();
        };
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

// Re-export everything for easy access
export * from "./types";
export * from "./util";
export * from "./file-loader";
export * from "./routing-strategy";

// Export React component (conditional to avoid errors when React is not available)
export { DruidUI as DruidUIReact } from "./react";
