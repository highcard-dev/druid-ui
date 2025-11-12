// Augment the Window interface to include 'druid'.
// We define a lightweight shape for better intellisense; extend as needed.

type DruidAPI = Record<string, any>;

declare global {
  interface Window {
    "druid-ui": {
      d: (...args: any[]) => any;
    };
    "druid-extension"?: DruidAPI;
  }
}

// Mark this file as a module so global augmentation is always applied reliably.
export {};
