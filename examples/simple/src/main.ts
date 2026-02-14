import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

/**
 * Simple Example - WASM Sandbox Mode
 *
 * This example demonstrates the basic usage of Druid UI with WASM sandbox.
 * The component is compiled to WebAssembly for isolation and security.
 */

const druidUiElement = new DruidUI();

// Use WASM entrypoint (sandbox mode is default)
druidUiElement.setAttribute("entrypoint", "/simple.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");
app?.appendChild(druidUiElement);

// Enable Hot Module Replacement for development
ViteHMR(druidUiElement);
