import { Renderer, type Library } from "@openuidev/react-lang";
import { useEffect, useRef, useState } from "react";
import { WasmRoot, type WasmRootProps } from "./wasm-root";

export type OpenUIHostProps<L extends Library> = Omit<
  WasmRootProps<L>,
  "response" | "children"
> & {
  openUiSourceUrl: string;
  children?: WasmRootProps<L>["children"];
};
export function OpenUIHost<L extends Library>({
  openUiSourceUrl,
  reloadKey,
  fetchResource,
  children,
  ...props
}: OpenUIHostProps<L>) {
  const fetchRef = useRef(fetchResource);
  fetchRef.current = fetchResource;
  const [loaded, setLoaded] = useState<{
    url: string;
    reloadKey: string | number | undefined;
    source: string;
  }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(undefined);
    setError(undefined);
    void (async () => {
      const response = await (fetchRef.current ?? globalThis.fetch)(
        openUiSourceUrl,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(`OpenUI document request failed (${response.status})`);
      const source = await response.text();
      if (!controller.signal.aborted)
        setLoaded({ url: openUiSourceUrl, reloadKey, source });
    })().catch((cause) => {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => controller.abort();
  }, [openUiSourceUrl, reloadKey]);
  if (error) return <p role="alert">Could not load UI: {error}</p>;
  if (
    !loaded ||
    loaded.url !== openUiSourceUrl ||
    loaded.reloadKey !== reloadKey
  )
    return <p role="status">Loading OpenUI and WASM…</p>;
  return (
    <WasmRoot
      key={openUiSourceUrl}
      {...props}
      response={loaded.source}
      reloadKey={reloadKey}
      fetchResource={fetchResource}
    >
      {children ?? <Renderer.Content />}
    </WasmRoot>
  );
}
