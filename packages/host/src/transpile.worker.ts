import { transpile } from "@bytecodealliance/jco";

interface TranspileRequest {
  buffer: ArrayBuffer;
  name: string;
}

interface TranspileResponse {
  files: Array<[string, Uint8Array]>;
}

self.onmessage = async (event: MessageEvent<TranspileRequest>) => {
  const { buffer, name } = event.data;

  try {
    const result = (await transpile(buffer, {
      name,
      instantiation: { tag: "async" },
    })) as TranspileResponse;

    // Transfer the file buffers back to the main thread (zero-copy)
    const transferables = result.files.map(([, content]) => content.buffer);
    self.postMessage(
      { success: true, data: result },
      { transfer: transferables }
    );
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
