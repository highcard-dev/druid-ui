import { HttpFileLoader } from "./file-loader";
import hid from "hyperid";
import { patch } from "./setup-snabbdom";
import { h, type VNode, type VNodeChildren, type VNodeData } from "snabbdom";
import { transpile } from "@bytecodealliance/jco";

export interface Prop {
  key: string;
  value: string;
}
export interface Props {
  prop: Array<Prop>;
  on: Array<[string, string]>;
}
export type Children = Array<string> | undefined;

export type RerenderFn = () => void;

export class DruidUI extends HTMLElement {
  private shadow: ShadowRoot;
  private wrapperEl: HTMLElement;
  private mountEl: HTMLElement;
  private profile: boolean = false;
  private currentVNode: VNode | null = null;
  private fl?: HttpFileLoader;
  private nodes = new Map<
    string,
    {
      element: string;
      props?: Props;
      children?: Array<string>;
    }
  >();

  private rootComponent: any;

  set fileloader(loader: HttpFileLoader) {
    this.fl = loader;

    const entrypoint = this.getAttribute("entrypoint");
    if (!entrypoint) {
      console.warn("No entrypoint attribute set.");
      return;
    }
    this.loadTranspile(entrypoint);
  }

  static get observedAttributes() {
    return ["entrypoint", "path", "profile", "css", "style", "fileloader"];
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string
  ) {
    switch (name) {
      case "entrypoint":
        this.fileloader = new HttpFileLoader(newValue);
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

  loadTranspile = async (file: string) => {
    const response = await fetch(file);

    const t = (await transpile(await response.arrayBuffer(), {
      name: "test",
      instantiation: { tag: "async" },
    })) as {
      files: Array<[string, Uint8Array]>;
    };

    for (const file of t.files) {
      const [f, content] = file as [string, Uint8Array];

      if (f.endsWith(".js")) {
        console.log("found js file:");
        console.log(content);
        const blob = new Blob([content], {
          type: "application/javascript",
        });

        const moduleUrl = URL.createObjectURL(blob);

        console.log("Importing module from URL:", moduleUrl);

        this.loadEntrypointFromUrl(moduleUrl, (filename: string) => {
          const [, content] = t.files.find((f) => f[0] === filename) || [];
          if (!content) {
            throw new Error(`File ${filename} not found in transpiled files.`);
          }
          return WebAssembly.compile(content);
        });

        URL.revokeObjectURL(moduleUrl);
        break;
      }
    }
  };

  async loadEntrypointFromUrl(
    entrypoint: string,
    loadCompile?: (file: string) => Promise<WebAssembly.Module>
  ) {
    const t = await import(/* @vite-ignore */ entrypoint!);

    const i = await t.instantiate(loadCompile, {
      "docs:adder/ui": {
        d: (element: string, props: Props, children: string[]) => {
          const id = hid();

          this.nodes.set(id.uuid, { element, props, children });
          return id.uuid;
        },
        log: (msg: string) => {
          console.log("UI LOG:", msg);
        },
      },
    });
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
      console.log("Rerendering with profiling enabled");
      // Start profiling
      renderStart = performance.now();
    }

    const rootId = this.rootComponent.initcomponent.init();

    if (this.profile) {
      const initEnd = performance.now();
      console.log(
        `Init completed in ${(initEnd - renderStart!).toFixed(2)} ms`
      );
    }

    this.mountEl.innerHTML = "";
    const dom = this.createDomFromIdRec(rootId);

    if (dom instanceof String) {
      console.warn("Root DOM is a string, cannot render:", dom);
      return;
    }
    if (this.currentVNode) {
      patch(this.currentVNode, dom);
    } else {
      patch(this.mountEl, dom);
      this.currentVNode = dom;
    }
    if (this.profile) {
      const renderEnd = performance.now();
      console.log(
        `Render completed in ${(renderEnd - renderStart!).toFixed(2)} ms`
      );
    }
  }

  private createDomFromIdRec(id: string): VNode | String {
    const node = this.nodes.get(id);
    //it is a bit strange to do it like that, in theory we want to better distinguish between text nodes and element nodes
    if (!node) {
      return id;
    }

    const data: VNodeData = {};

    // Set properties
    if (node.props) {
      data.props = {};
      for (const prop of node.props.prop) {
        data.props[prop.key] = prop.value;
      }
      data.on = {};
      for (const eventHandler of node.props.on) {
        const [eventType, fnid] = eventHandler;
        if (eventHandler) {
          data.on[eventType] = (e) => {
            const r = this.rootComponent;
            this.rootComponent.initcomponent.emit(
              fnid,
              eventType,
              new r.initcomponent.Event(
                e?.currentTarget?.value,
                e?.currentTarget?.checked
              )
            );
            this.rerender();
          };
        }
      }
    }

    const ch: VNodeChildren = [];
    if (node.children) {
      for (const childId of node.children) {
        const childEl = this.createDomFromIdRec(childId);
        ch.push(childEl);
      }
    }

    return h(node.element, data, ch);
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
