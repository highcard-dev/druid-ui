import { HttpFileLoader } from "./file-loader";
import { patch } from "./setup-snabbdom";
import { type VNode } from "snabbdom";
import {
  HistoryRoutingStrategy,
  type RoutingStrategy,
} from "./routing-strategy";
import { loadTranspile } from "./transpile";
import {
  clearNodes,
  createDomFromIdRec,
  dfunc,
  logfunc,
  setHook,
} from "./host-functions";
import { Event } from "./types";
import { setCb } from "./utils";

export interface Props {
  prop: { key: string; value: any }[];
  on: string[]; // [eventType, fnid]
}

// Dev-time log function exposed for components importing from "druid:ui/ui".
export function log(msg: string) {
  // Reuse internal logfunc for consistent labeling.
  logfunc(msg);
}

export class DruidUI extends HTMLElement {
  private shadow: ShadowRoot;
  private wrapperEl: HTMLElement;
  private mountEl: HTMLElement;
  private profile: boolean = false;
  private currentVNode: VNode | null = null;
  private _routeStrategy: RoutingStrategy = new HistoryRoutingStrategy();
  private loader = new HttpFileLoader();
  private _sandbox: boolean = true;
  private _extensionObject: object = {};
  private _entrypoint?: string;
  private rootComponent: any;
  private _connected: boolean = false;
  private reloadGeneration: number = 0;

  public connectedCallback() {
    this._connected = true;
    if (this.rootComponent) {
      this.rerender();
      return;
    }
    this.reloadComponent();
  }

  public disconnectedCallback() {
    this._connected = false;
  }

  public reloadComponent() {
    if (!this._connected) {
      console.warn("Component not connected, skipping reload.");
      return;
    }
    const entrypoint = this._entrypoint;
    if (!entrypoint) {
      console.warn("No entrypoint attribute set.");
      return;
    }
    if (!this.loader) {
      console.warn("No file loader set.");
      return;
    }

    // Increment generation to invalidate all pending operations from previous load
    this.reloadGeneration++;
    console.debug(
      `[reloadComponent] Starting reload, generation: ${this.reloadGeneration}`,
    );

    // Clear nodes map to ensure fresh state
    clearNodes();

    if (this._sandbox) {
      loadTranspile(entrypoint, this.loader)
        .then(([moduleUrl, compile]) => {
          this.loadEntrypointFromWasmUrl(moduleUrl, compile);
        })
        .catch((e) => {
          console.error("Failed to load and transpile entrypoint:", e);
        });
    } else {
      this.loadEntrypointFromJavaScriptUrl(entrypoint);
    }
  }

  public getWrapper(): HTMLElement {
    return this.wrapperEl;
  }
  set fileloader(loader: HttpFileLoader) {
    this.loader = loader;
    this.reloadComponent();
  }

  set extensionObject(obj: object) {
    this._extensionObject = obj;
  }
  set entrypoint(entrypoint: string) {
    this._entrypoint = entrypoint;
    this.reloadComponent();
  }

  set sandbox(sandbox: boolean) {
    this._sandbox = sandbox;
    this.reloadComponent();
  }

  set routeStrategy(strategy: RoutingStrategy) {
    this._routeStrategy = strategy;
    this.rerender();
  }

  static get observedAttributes() {
    return ["entrypoint", "path", "profile", "css", "style", "no-sandbox"];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string,
  ) {
    switch (name) {
      case "no-sandbox":
        this._sandbox = newValue !== "true";
        break;
      case "entrypoint":
        this.entrypoint = newValue;
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
          this.shadow.querySelectorAll('link[rel="stylesheet"]'),
        ).pop();
        //clear previous style elements
        const existingStyles = this.shadow.querySelectorAll("style");
        existingStyles.forEach((style) => style.remove());

        if (lastLink) {
          this.shadow.insertBefore(styleEl, lastLink.nextSibling);
        } else {
          this.shadow.insertBefore(
            styleEl,
            this.shadowRoot?.firstChild || null,
          );
        }
        break;
      case "css":
        const css = newValue.split(",");
        //clear previous css links
        const existingLinks = this.shadow.querySelectorAll(
          'link[rel="stylesheet"]',
        );
        existingLinks.forEach((link) => link.remove());

        for (const comp of css) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = comp;
          this.shadow.insertBefore(link, this.shadowRoot?.firstChild || null);
        }
        break;
    }
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });

    this.wrapperEl = document.createElement("div");
    this.wrapperEl.classList.add("druid-wrapper");
    this.mountEl = document.createElement("div");
    this.mountEl.classList.add("druid-mount");
    this.mountEl.innerText = "Transpiling...";

    this.wrapperEl.appendChild(this.mountEl);
    this.shadow.appendChild(this.wrapperEl);
  }

  private getExtensionObject() {
    return {
      "druid:ui/ui": {
        d: (element: string, props: Props, children: string[]) => {
          return dfunc(element, props, children);
        },
        log: (msg: string) => {
          logfunc(msg);
        },
        rerender: () => {
          setTimeout(() => this.rerender(), 0);
        },
        setHook: setHook,
      },
      "druid:ui/utils": {
        Event: Event,
      },
      ...this._extensionObject,
    };
  }

  async loadEntrypointFromJavaScriptUrl(entrypoint: string) {
    // Capture the generation at the start of this load
    const loadGeneration = this.reloadGeneration;
    console.debug(
      `[loadEntrypointFromJavaScriptUrl] Starting load for generation ${loadGeneration}`,
    );

    window["druid-extension"] = this.getExtensionObject();

    // Force no-cache to get fresh content
    const response = await this.loader.load(entrypoint, { cache: false });
    const bundleContent = response.buffer;

    // Create blob URL to avoid Vite's /public restrictions
    const blob = new Blob([bundleContent], { type: "application/javascript" });
    const moduleUrl = URL.createObjectURL(blob);
    const t = await import(/* @vite-ignore */ moduleUrl);
    console.debug(
      `[loadEntrypointFromJavaScriptUrl] Module loaded for generation ${loadGeneration}, current generation: ${this.reloadGeneration}`,
    );

    setCb(t.component.asyncComplete);

    // Only proceed if no newer reload has been triggered
    if (this.reloadGeneration !== loadGeneration) {
      console.debug(
        `[loadEntrypointFromJavaScriptUrl] Aborting stale load (generation ${loadGeneration}, current: ${this.reloadGeneration})`,
      );
      URL.revokeObjectURL(moduleUrl);
      return;
    }

    this.rootComponent = t;

    // Reset VNode right before rendering new module to ensure hooks fire
    // This must be done here (not in reloadComponent) to avoid race conditions
    // with pending rerenders from previous module.
    // After the first render, snabbdom's patch() replaces mountEl in the DOM
    // with the VNode element, leaving mountEl detached. We must restore it
    // so the next patch(mountEl, dom) can insert the new element.
    if (this.currentVNode?.elm?.parentNode) {
      this.currentVNode.elm.parentNode.replaceChild(
        this.mountEl,
        this.currentVNode.elm as Node,
      );
    }
    this.mountEl.innerHTML = "";
    this.currentVNode = null;
    console.debug(
      `[loadEntrypointFromJavaScriptUrl] Rendering generation ${loadGeneration}`,
    );

    this.rerender();
    URL.revokeObjectURL(moduleUrl);
  }

  async loadEntrypointFromWasmUrl(
    entrypoint: string,
    loadCompile?: (file: string) => Promise<WebAssembly.Module>,
  ) {
    const t = await import(/* @vite-ignore */ entrypoint!);

    URL.revokeObjectURL(entrypoint);

    const i = await t.instantiate(loadCompile, this.getExtensionObject());
    setCb(i.component.asyncComplete);

    this.rootComponent = i;
    this.rerender();
  }

  rerender() {
    if (!this.rootComponent) {
      console.warn("Root component not initialized yet.");
      return;
    }
    let renderStart;
    if (this.profile) {
      // Start profiling
      renderStart = performance.now();
    }

    const rootId = this.rootComponent.component.init({
      path: this._routeStrategy.getCurrentPath(),
    });

    if (this.profile) {
      const initEnd = performance.now();
      console.debug(
        `Init completed in ${(initEnd - renderStart!).toFixed(2)} ms`,
      );
    }

    this.mountEl.innerHTML = "";
    const dom = createDomFromIdRec(
      rootId,
      (nodeId, eventType, e) => {
        this.rootComponent.component.emit(nodeId, eventType, e);
        // Capture the current generation
        const generation = this.reloadGeneration;
        setTimeout(() => {
          // Only rerender if we're still in the same generation (no reload happened)
          if (this.reloadGeneration === generation) {
            this.rerender();
          } else {
            console.debug(
              `[setTimeout] Skipping stale rerender (generation ${generation}, current: ${this.reloadGeneration})`,
            );
          }
        }, 0);
      },
      (href: string) => {
        this._routeStrategy.navigateTo(href);
        this.rerender();
      },
    );

    if (dom instanceof String) {
      console.warn("Root DOM is a string, cannot render:", dom);
      return;
    }
    if (this.currentVNode) {
      patch(this.currentVNode, dom);
    } else {
      patch(this.mountEl, dom);
    }
    this.currentVNode = dom;
    if (this.profile) {
      const renderEnd = performance.now();
      console.debug(
        `Render completed in ${(renderEnd - renderStart!).toFixed(2)} ms`,
      );
    }
  }
}

customElements.define("druid-ui", DruidUI);
