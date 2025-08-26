import { PluginOption } from "vite";

export default function I18nHotReload(): PluginOption {
  return {
    name: "i18n-hot-reload",
    handleHotUpdate({ file, server }) {
      if (file.endsWith(".lua")) {
        server.ws.send({
          type: "custom",
          event: "lua-update",
        });
      }
    },
  };
}
