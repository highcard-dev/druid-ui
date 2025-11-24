import { HttpFileLoader } from "./file-loader";
import { patch } from "./setup-snabbdom";
import { type VNode } from "snabbdom";
import {
  HistoryRoutingStrategy,
  type RoutingStrategy,
} from "./routing-strategy";
import { loadTranspile } from "./transpile";
import { createDomFromIdRec, dfunc, logfunc } from "./host-functions";
import { Event } from "./types";
import { setCb } from "./utils";

export interface Props {
  prop: { key: string; value: any }[];
  on: [string, string][]; // [eventType, fnid]
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

  public reloadComponent() {
    const entrypoint = this._entrypoint;
    if (!entrypoint) {
      console.warn("No entrypoint attribute set.");
      return;
    }
    if (!this.loader) {
      console.warn("No file loader set.");
      return;
    }
    if (this._sandbox) {
      loadTranspile(entrypoint, this.loader).then(([moduleUrl, compile]) => {
        this.loadEntrypointFromWasmUrl(moduleUrl, compile);
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
    this.reloadComponent();
  }

  static get observedAttributes() {
    return ["entrypoint", "path", "profile", "css", "style", "no-sandbox"];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string
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
          this.shadow.querySelectorAll('link[rel="stylesheet"]')
        ).pop();
        //clear previous style elements
        const existingStyles = this.shadow.querySelectorAll("style");
        existingStyles.forEach((style) => style.remove());

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
      },
      "druid:ui/utils": {
        Event: Event,
      },
      ...this._extensionObject,
    };
  }

  async loadEntrypointFromJavaScriptUrl(entrypoint: string) {
    window["druid-ui"] = {
      d: dfunc,
    };

    window["druid-extension"] = this.getExtensionObject();

    const response = await this.loader.load(entrypoint);

    const bundleContent = response.buffer;

    //load bundleContent as a module
    const blob = new Blob([bundleContent], { type: "application/javascript" });
    const moduleUrl = URL.createObjectURL(blob);
    const t = await import(/* @vite-ignore */ moduleUrl);

    setCb(t.component.asyncComplete);
    this.rootComponent = t;
    this.rerender();
    URL.revokeObjectURL(moduleUrl);
  }

  async loadEntrypointFromWasmUrl(
    entrypoint: string,
    loadCompile?: (file: string) => Promise<WebAssembly.Module>
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
      console.log(
        `Init completed in ${(initEnd - renderStart!).toFixed(2)} ms`
      );
    }

    this.mountEl.innerHTML = "";
    const dom = createDomFromIdRec(
      rootId,
      (fnid, eventType, e) => {
        this.rootComponent.component.emit(fnid, eventType, e);
        this.rerender();
      },
      (href: string) => {
        this._routeStrategy.navigateTo(href);
        this.rerender();
      }
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
      console.log(
        `Render completed in ${(renderEnd - renderStart!).toFixed(2)} ms`
      );
    }
  }
}

customElements.define("druid-ui", DruidUI);
