import type { FileLoader } from "./file-loader";

interface TranspileResult {
  files: Array<[string, Uint8Array]>;
}

const transpileInWorker = async (
  buffer: ArrayBuffer,
  name: string
): Promise<TranspileResult> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./transpile.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent) => {
      worker.terminate();
      if (event.data.success) {
        resolve(event.data.data);
      } else {
        reject(new Error(event.data.error));
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };

    // Transfer the buffer ownership to the worker (zero-copy)
    worker.postMessage({ buffer, name }, [buffer]);
  });
};

export const loadTranspile = async (
  file: string,
  fileLoader: FileLoader
): Promise<[string, (filename: string) => Promise<WebAssembly.Module>]> => {
  const response = await fileLoader.load(file);
  if (!response) {
    throw new Error(`Failed to load file: ${file}`);
  }
  const files: Record<string, string> = {};
  const t = await transpileInWorker(response.buffer, "test");

  for (const file of t.files) {
    const [f, content] = file as [string, Uint8Array];

    let blob: Blob | null = null;
    if (f.endsWith(".js")) {
      blob = new Blob([new Uint8Array(content)], {
        type: "application/javascript",
      });
    } else if (f.endsWith(".wasm")) {
      blob = new Blob([new Uint8Array(content)], {
        type: "application/wasm",
      });
    }
    if (blob) {
      const url = URL.createObjectURL(blob);
      files[f] = url;
    }
  }
  const jsFileEntry = Object.entries(files).find(([filename]) =>
    filename.endsWith(".js")
  );
  if (!jsFileEntry) {
    throw new Error("No JavaScript file found in transpiled output.");
  }
  return [
    jsFileEntry[1],
    async (filename: string) => {
      const url = files[filename];
      if (!url) {
        throw new Error(`File ${filename} not found in transpiled output.`);
      }
      const wasmResponse = await fetch(url);
      const wasmBuffer = await wasmResponse.arrayBuffer();
      return await WebAssembly.compile(wasmBuffer);
    },
  ];
};
