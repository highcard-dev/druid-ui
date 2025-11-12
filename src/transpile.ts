import { transpile } from "@bytecodealliance/jco";
import type { FileLoader } from "./file-loader";

export const loadTranspile = async (
  file: string,
  fileLoader: FileLoader
): Promise<[string, (filename: string) => Promise<WebAssembly.Module>]> => {
  const response = await fileLoader.load(file);
  if (!response) {
    throw new Error(`Failed to load file: ${file}`);
  }

  const t = (await transpile(response.buffer, {
    name: "test",
    instantiation: { tag: "async" },
  })) as {
    files: Array<[string, Uint8Array]>;
  };

  for (const file of t.files) {
    const [f, content] = file as [string, Uint8Array];

    if (f.endsWith(".js")) {
      const blob = new Blob([new Uint8Array(content)], {
        type: "application/javascript",
      });

      const moduleUrl = URL.createObjectURL(blob);

      return [
        moduleUrl,
        (filename: string) => {
          const [, content] = t.files.find((f) => f[0] === filename) || [];
          if (!content) {
            throw new Error(`File ${filename} not found in transpiled files.`);
          }
          return WebAssembly.compile(new Uint8Array(content));
        },
      ];
    }
  }
  throw new Error("No JavaScript file found in transpiled output.");
};
