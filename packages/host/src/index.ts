// Re-export everything for easy access
export * from "./ui";
export * from "./types";
export * from "./file-loader";
export * from "./routing-strategy";
export * from "./transpile";
export * from "./utils";

// Global Window augmentation (side-effect import for declaration output)
import "./window";
