import { generate, $init } from "@bytecodealliance/jco-transpile/component";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    await $init;
    const result = await generate(new Uint8Array(event.data), {
      name: "client",
      instantiation: { tag: "async" },
      noTypescript: true,
      noNodejsCompat: true,
      base64Cutoff: 0,
    });
    self.postMessage({ files: result.files });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
