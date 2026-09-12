import { patch } from "./snabbdom";
import { type VNode } from "snabbdom";
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

export const DRUID_UI_READY_EVENT = "druid-ui-ready";
export const DRUID_UI_ERROR_EVENT = "druid-ui-error";

export class DruidUI extends HTMLElement {
  private shadow: ShadowRoot;
  private wrapperEl: HTMLElement;
  private mountEl: HTMLElement;
  private statusEl: HTMLElement;
  private profile: boolean = false;
  private currentVNode: VNode | null = null;
  private reloadGeneration: number = 0;
  private rootComponent: any;
  private _sandbox: boolean = true;
  private _extensionObject: object = {};
  private _entrypoint?: string;
  private _connected: boolean = false;
  private _buffer?: ArrayBuffer;

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

  public async reloadComponent() {
    if (!this._connected) {
      console.warn("Component not connected, skipping reload.");
      return;
    }
    const loadGeneration = ++this.reloadGeneration;
    let buffer: ArrayBuffer;

    // Fetch entrypoint and update buffer when entrypoint is set.
    if (this._entrypoint) {
      let res: Response;
      try {
        res = await fetch(this._entrypoint, { cache: "no-store" });
      } catch (e) {
        this.showError("Failed to fetch entrypoint", e, loadGeneration);
        return;
      }
      if (!res.ok) {
        this.showError(
          "Failed to fetch entrypoint",
          `${res.status} ${res.statusText} — ${this._entrypoint}`,
          loadGeneration,
        );
        return;
      }
      buffer = await res.arrayBuffer();
    } else if (this._buffer) {
      buffer = this._buffer;
    } else {
      console.warn("No entrypoint or buffer attribute set.");
      return;
    }

    if (this.reloadGeneration !== loadGeneration) {
      return;
    }
    console.debug(
      `[reloadComponent] Starting reload, generation: ${this.reloadGeneration}`,
    );

    // Clear nodes map to ensure fresh state
    clearNodes();

    try {
      if (this._sandbox) {
        this.showTranspiling(loadGeneration);
        const [moduleUrl, compile] = await loadTranspile(buffer);
        await this.loadEntrypointFromWasmUrl(
          moduleUrl,
          compile,
          loadGeneration,
        );
      } else {
        await this.loadEntrypointFromJavaScriptUrl(buffer, loadGeneration);
      }
    } catch (e) {
      this.showError(
        this._sandbox
          ? "Failed to transpile Druid UI"
          : "Failed to load Druid UI",
        e,
        loadGeneration,
      );
    }
  }

  public getWrapper(): HTMLElement {
    return this.wrapperEl;
  }
  set buffer(buffer: ArrayBuffer) {
    this._buffer = buffer;
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

  public reportError(title: string, error: unknown) {
    const generation = ++this.reloadGeneration;
    this.showError(title, error, generation);
  }

  static get observedAttributes() {
    return ["entrypoint", "path", "profile", "no-sandbox"];
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
    }
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });

    this.wrapperEl = document.createElement("div");
    this.wrapperEl.classList.add("druid-wrapper");
    this.mountEl = document.createElement("div");
    this.mountEl.classList.add("druid-mount");
    this.statusEl = document.createElement("div");
    this.statusEl.dataset["druidUiStatus"] = "";
    this.statusEl.setAttribute("role", "status");
    this.statusEl.setAttribute("aria-live", "polite");

    const style = document.createElement("style");
    style.textContent = `
      .druid-wrapper { min-height: 220px; position: relative; }
      [data-druid-ui-status] {
        align-items: center;
        background: color-mix(in srgb, Canvas 94%, transparent);
        color: CanvasText;
        display: none;
        inset: 0;
        justify-content: center;
        min-height: 220px;
        padding: 24px;
        position: absolute;
        z-index: 10;
      }
      [data-druid-ui-status][data-state="loading"],
      [data-druid-ui-status][data-state="error"] { display: flex; }
      .druid-build {
        border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
        border-radius: 8px;
        box-shadow: 0 18px 48px color-mix(in srgb, CanvasText 10%, transparent);
        max-width: 430px;
        overflow: hidden;
        width: 100%;
      }
      .druid-build__header {
        align-items: center;
        background: color-mix(in srgb, CanvasText 5%, Canvas);
        display: flex;
        gap: 10px;
        padding: 12px 14px;
      }
      .druid-build__pulse {
        animation: druid-build-pulse 1.2s ease-in-out infinite;
        background: #22c55e;
        border-radius: 50%;
        box-shadow: 0 0 0 0 color-mix(in srgb, #22c55e 45%, transparent);
        height: 8px;
        width: 8px;
      }
      .druid-build__title { font: 600 13px/1.2 ui-monospace, monospace; }
      .druid-build__code {
        background: color-mix(in srgb, CanvasText 3%, Canvas);
        display: grid;
        gap: 10px;
        padding: 18px;
      }
      .druid-build__line {
        animation: druid-build-line 1.5s ease-in-out infinite;
        background: color-mix(in srgb, CanvasText 13%, transparent);
        border-radius: 3px;
        height: 7px;
        overflow: hidden;
        position: relative;
      }
      .druid-build__line::after {
        animation: druid-build-scan 1.5s ease-in-out infinite;
        background: linear-gradient(90deg, transparent, #22c55e, #f59e0b, transparent);
        content: "";
        inset: 0;
        position: absolute;
        transform: translateX(-100%);
      }
      .druid-build__line:nth-child(2) { animation-delay: 120ms; width: 82%; }
      .druid-build__line:nth-child(2)::after { animation-delay: 120ms; }
      .druid-build__line:nth-child(3) { animation-delay: 240ms; width: 64%; }
      .druid-build__line:nth-child(3)::after { animation-delay: 240ms; }
      .druid-build__message { color: color-mix(in srgb, CanvasText 62%, transparent); font: 12px/1.4 system-ui, sans-serif; }
      .druid-build--error { border-color: color-mix(in srgb, #ef4444 55%, transparent); }
      .druid-build--error .druid-build__header { color: #dc2626; }
      .druid-build--error pre { margin: 0; overflow: auto; white-space: pre-wrap; word-break: break-word; }
      @keyframes druid-build-pulse { 50% { box-shadow: 0 0 0 7px transparent; opacity: .75; } }
      @keyframes druid-build-line { 50% { opacity: .55; } }
      @keyframes druid-build-scan { 65%, 100% { transform: translateX(100%); } }
      @media (prefers-reduced-motion: reduce) {
        .druid-build__pulse, .druid-build__line, .druid-build__line::after { animation: none; }
      }
    `;

    this.wrapperEl.appendChild(this.mountEl);
    this.wrapperEl.appendChild(this.statusEl);
    this.shadow.appendChild(style);
    this.shadow.appendChild(this.wrapperEl);
  }

  private showTranspiling(generation: number) {
    if (this.reloadGeneration !== generation) return;
    this.statusEl.dataset["state"] = "loading";
    this.statusEl.innerHTML = `
      <div class="druid-build">
        <div class="druid-build__header">
          <span class="druid-build__pulse"></span>
          <span class="druid-build__title">Transpiling Druid UI</span>
        </div>
        <div class="druid-build__code">
          <span class="druid-build__line"></span>
          <span class="druid-build__line"></span>
          <span class="druid-build__line"></span>
          <span class="druid-build__message">Preparing the sandboxed WebAssembly module...</span>
        </div>
      </div>`;
  }

  private finishLoading(generation: number) {
    if (this.reloadGeneration !== generation) return;
    delete this.statusEl.dataset["state"];
    this.statusEl.innerHTML = "";
    this.dispatchEvent(
      new CustomEvent(DRUID_UI_READY_EVENT, {
        bubbles: true,
        composed: true,
        detail: { generation },
      }),
    );
  }

  private showError(title: string, error: unknown, generation: number) {
    if (this.reloadGeneration !== generation) return;
    const message =
      error instanceof Error ? error.message : String(error);
    this.statusEl.dataset["state"] = "error";
    this.statusEl.innerHTML = "";
    const container = document.createElement("div");
    container.className = "druid-build druid-build--error";
    const heading = document.createElement("div");
    heading.className = "druid-build__header druid-build__title";
    heading.textContent = title;
    const details = document.createElement("pre");
    details.className = "druid-build__code druid-build__message";
    details.textContent = message;
    container.append(heading, details);
    this.statusEl.appendChild(container);
    this.dispatchEvent(
      new CustomEvent(DRUID_UI_ERROR_EVENT, {
        bubbles: true,
        composed: true,
        detail: { generation, message, title },
      }),
    );
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

  async loadEntrypointFromJavaScriptUrl(
    bundleContent: ArrayBuffer,
    loadGeneration = this.reloadGeneration,
  ) {
    console.debug(
      `[loadEntrypointFromJavaScriptUrl] Starting load for generation ${loadGeneration}`,
    );

    window["druid-extension"] = this.getExtensionObject();

    // Create blob URL to avoid Vite's /public restrictions
    const blob = new Blob([bundleContent], { type: "application/javascript" });
    const moduleUrl = URL.createObjectURL(blob);
    try {
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
      this.finishLoading(loadGeneration);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  }

  async loadEntrypointFromWasmUrl(
    entrypoint: string,
    loadCompile?: (file: string) => Promise<WebAssembly.Module>,
    loadGeneration = this.reloadGeneration,
  ) {
    let i;
    try {
      const t = await import(/* @vite-ignore */ entrypoint!);
      i = await t.instantiate(loadCompile, this.getExtensionObject());
    } finally {
      URL.revokeObjectURL(entrypoint);
    }
    if (this.reloadGeneration !== loadGeneration) {
      return;
    }
    setCb(i.component.asyncComplete);

    this.rootComponent = i;
    this.rerender();
    this.finishLoading(loadGeneration);
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

    const rootId = this.rootComponent.component.init([]);

    if (this.profile) {
      const initEnd = performance.now();
      console.debug(
        `Init completed in ${(initEnd - renderStart!).toFixed(2)} ms`,
      );
    }

    this.mountEl.innerHTML = "";
    const dom = createDomFromIdRec(rootId, (nodeId, eventType, e) => {
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
    });

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
