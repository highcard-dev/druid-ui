import type { DruidUI } from "../ui";

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
