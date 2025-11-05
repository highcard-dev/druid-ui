// Augment the Window interface to include 'druid'.
// We define a lightweight shape for better intellisense; extend as needed.
interface DruidAPI {
  d?: (element: string, props: any, children: string[]) => any;
  log?: (msg: string) => void;
  // Add additional fields exported by the runtime here.
}

declare global {
  interface Window {
    druid?: DruidAPI;
  }
}

// Mark this file as a module so global augmentation is always applied reliably.
export {};
