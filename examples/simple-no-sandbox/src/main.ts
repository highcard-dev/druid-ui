import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

/**
 * Simple Example - No Sandbox Mode
 *
 * This example runs JavaScript directly without WASM compilation.
 * Faster development iteration but no sandboxing.
 * Demonstrates hook lifecycle with component reload.
 */

const druidUiElement = new DruidUI();

// Disable sandbox to run raw JavaScript
druidUiElement.sandbox = false;
druidUiElement.setAttribute("entrypoint", "/simple.bundled-raw.js");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");
app?.appendChild(druidUiElement);

// Manually trigger initial load
druidUiElement.reloadComponent();

// Enable Hot Module Replacement for development
ViteHMR(druidUiElement);
