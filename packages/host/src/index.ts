// Re-export everything for easy access
export * from "./ui";
export * from "./types";
export * from "./transpile";
export * from "./utils";
export * from "./react-components";

// Global Window augmentation (side-effect import for declaration output)
import "./window";
