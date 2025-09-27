import { type LuaEngine, LuaFactory } from "wasmoon";
import type { Component, Routes } from "./types";
import { dfunc } from "./util.js";
import { HttpFileLoader } from "./file-loader";
import { createRoutingStrategy } from "./routing-strategy";
import { type VNode } from "snabbdom";
import { patch } from "./setup-snabbdom";

export type RerenderFn = () => void;

const factory = new LuaFactory();

export class DruidUI extends HTMLElement {
  private loadedRoutes?: Routes;
  private initElementList: Component[] = [];

  private shadow: ShadowRoot;
  private mountEl: HTMLElement;
  private currentFrame?: VNode;

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

  useComponent(component: Component, props: any = {}): VNode {
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
    const vnode = this.useComponent(component);
    if (this.currentFrame) {
      patch(this.currentFrame, vnode);
    } else {
      patch(this.mountEl, vnode);
    }
    this.currentFrame = vnode;

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
