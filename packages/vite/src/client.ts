/// <reference types="vite/client" />
import type { DruidUI } from "@druid-ui/host";

export const ViteHMR = (druidUiElement: DruidUI) => {
  if (import.meta.hot) {
    console.log("HMR enabled");
    import.meta.hot.on("ui-update", (data) => {
      const reason = data?.reason;
      console.log("UI update:", reason);

      druidUiElement.reloadComponent();
    });
  }
};
