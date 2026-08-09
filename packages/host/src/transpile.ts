interface TranspileResult {
  files: Array<[string, Uint8Array]>;
}

interface CacheEntry {
  jsUrl: string;
  fileUrls: Record<string, string>;
}

const CACHE_KEY_PREFIX = "transpile_cache_";
const WORKER_TIMEOUT_MS = 15_000;

// Helper functions for localStorage caching
const getCachedEntry = (file: string): CacheEntry | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + file);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("Failed to read from cache:", e);
  }
  return null;
};

const setCachedEntry = (file: string, entry: CacheEntry): void => {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + file, JSON.stringify(entry));
  } catch (e) {
    console.warn("Failed to write to cache:", e);
  }
};

const transpileInWorker = async (
  buffer: ArrayBuffer,
  name: string,
): Promise<TranspileResult> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./transpile.worker.ts", import.meta.url),
      { type: "module" },
    );

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error("Druid UI transpile worker timed out")));
    }, WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent) => {
      if (event.data.success) {
        finish(() => resolve(event.data.data));
      } else {
        finish(() => reject(new Error(event.data.error)));
      }
    };

    worker.onerror = (error) => {
      finish(() => reject(error));
    };

    // Keep the caller's buffer usable after posting to the worker.
    const workerBuffer = buffer.slice(0);
    try {
      worker.postMessage({ buffer: workerBuffer, name }, [workerBuffer]);
    } catch (error) {
      finish(() => reject(error));
    }
  });
};

export const loadTranspile = async (
  buffer: ArrayBuffer,
): Promise<[string, (filename: string) => Promise<WebAssembly.Module>]> => {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  const hashString = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Check cache first
  const cached = getCachedEntry(hashString);
  if (cached) {
    // Verify URLs are still valid
    try {
      await fetch(cached.jsUrl, { method: "HEAD" });
      return [
        cached.jsUrl,
        async (filename: string) => {
          const url = cached.fileUrls[filename];
          if (!url) {
            throw new Error(`File ${filename} not found in transpiled output.`);
          }
          const wasmResponse = await fetch(url);
          const wasmBuffer = await wasmResponse.arrayBuffer();
          return await WebAssembly.compile(wasmBuffer);
        },
      ];
    } catch (e) {
      // Cache is stale, proceed with transpilation
      console.warn("Cached URLs are stale, re-transpiling");
    }
  }

  const files: Record<string, string> = {};
  const t = await transpileInWorker(buffer, "test");

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
    filename.endsWith(".js"),
  );
  if (!jsFileEntry) {
    throw new Error("No JavaScript file found in transpiled output.");
  }

  // Cache the result
  const cacheEntry: CacheEntry = {
    jsUrl: jsFileEntry[1],
    fileUrls: files,
  };
  setCachedEntry(hashString, cacheEntry);

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
