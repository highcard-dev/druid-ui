import { defineConfig } from "vite";
// Guests are built separately so the demo also works without a host Rust install.
export default defineConfig({ server: { host: "127.0.0.1" } });
