import { transpile } from "@bytecodealliance/jco";

interface TranspileRequest {
  buffer: ArrayBuffer;
  name: string;
}

interface TranspileResponse {
  files: Array<[string, Uint8Array]> | Record<string, Uint8Array>;
}

function getTranspiledFileEntries(
  files: TranspileResponse["files"],
): Array<[string, Uint8Array]> {
  return Array.isArray(files) ? files : Object.entries(files);
}

async function transpileAsync(buffer: ArrayBuffer, name: string) {
  try {
    return (await transpile(buffer, {
      name,
      instantiation: "async",
    })) as TranspileResponse;
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes("invalid variant tag value") &&
      e.message.includes("InstantiationMode")
    ) {
      return (await transpile(buffer, {
        name,
        instantiation: { tag: "async" },
      })) as TranspileResponse;
    }
    throw e;
  }
}

self.onmessage = async (event: MessageEvent<TranspileRequest>) => {
  const { buffer, name } = event.data;

  try {
    const result = await transpileAsync(buffer, name);

    // Transfer the file buffers back to the main thread (zero-copy)
    const files = getTranspiledFileEntries(result.files);
    const transferables = files.map(([, content]) => content.buffer);
    self.postMessage(
      { success: true, data: { ...result, files } },
      { transfer: transferables }
    );
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
