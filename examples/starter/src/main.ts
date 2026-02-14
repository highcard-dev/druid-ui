/// <reference types="vite/client" />
import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

/**
 * Starter Template
 *
 * A minimal starting point for new Druid UI projects.
 * Automatically switches between sandbox and no-sandbox mode based on environment.
 */

const druidUiElement = new DruidUI();

if (import.meta.env.DEV) {
  // Development: use raw mode for faster iteration
  druidUiElement.sandbox = false;
  druidUiElement.setAttribute("entrypoint", "/app.bundled-raw.js");
} else {
  // Production: use WASM sandbox for security
  druidUiElement.setAttribute("entrypoint", "/app.wasm");
}

const app = document.getElementById("app");
app?.appendChild(druidUiElement);

// Enable Hot Module Replacement for development
ViteHMR(druidUiElement);
