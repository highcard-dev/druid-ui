import {
  createConfigEditorComponent,
  withMissingFileFallback,
  type FileGateway,
} from "../../../packages/config-editor/src/index.js";
// The example consumes the workspace source so package edits participate in raw
// hot reload during local development. Released Scroll UIs consume the package.
import {
  loadFileFromDeployment,
  saveFileToDeploymentIfMatch,
} from "@druid-ui/plattform";

const gateway = withMissingFileFallback({
  async load(path) {
    return await loadFileFromDeployment(path);
  },
  async save(path, content, expectedFingerprint) {
    return JSON.parse(
      await saveFileToDeploymentIfMatch(path, content, expectedFingerprint),
    );
  },
} satisfies FileGateway);

export const component = createConfigEditorComponent({
  manifestPath: "private/config-editor.manifest.json",
  gateway,
});
