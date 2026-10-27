import {
  Renderer,
  useGetFieldValue,
  useSetFieldValue,
  type Library,
  type RendererProps,
} from "@openuidev/react-lang";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  loadWasmClient,
  type WasmClient,
  type ResourceFetcher,
  type AdditionalImports,
} from "./wasm";
import {
  createToolSession,
  type ToolSession,
  type ToolProvider,
} from "./tools";

export type WasmRootProps<L extends Library> = Omit<
  RendererProps<L>,
  "children" | "toolProvider"
> & {
  wasmUrl?: string;
  reloadKey?: string | number;
  fetchResource?: ResourceFetcher;
  additionalImports?: AdditionalImports;
  toolProvider?: ToolProvider;
  onRuntimeError?: (error: unknown) => void;
  children: ReactNode;
};

export function WasmRoot<L extends Library>({
  reloadKey,
  ...props
}: WasmRootProps<L>) {
  return (
    <RootSession key={JSON.stringify([props.wasmUrl, reloadKey])} {...props} />
  );
}

function RootSession<L extends Library>({
  wasmUrl,
  fetchResource,
  additionalImports,
  toolProvider,
  onRuntimeError,
  onAction,
  children,
  ...rendererProps
}: WasmRootProps<L>) {
  const client = useRef<WasmClient | null>(null);
  const session = useRef<ToolSession | null>(null);
  const latest = useRef({
    toolProvider,
    fetchResource,
    additionalImports,
    onRuntimeError,
  });
  latest.current = {
    toolProvider,
    fetchResource,
    additionalImports,
    onRuntimeError,
  };
  const tools = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(toolProvider ?? {}).map((name) => [
          name,
          (args: Record<string, unknown>) => {
            if (!session.current)
              return Promise.reject(new Error("Runtime is not initialized"));
            return session.current.run(
              name,
              args as Parameters<ToolSession["run"]>[1],
            );
          },
        ]),
      ),
    [toolProvider],
  );
  return (
    <Renderer.Root
      {...rendererProps}
      toolProvider={tools}
      onAction={(event) => {
        try {
          client.current?.dispatch(event.type, event.params);
        } catch (error) {
          (latest.current.onRuntimeError ?? console.error)(error);
        }
        onAction?.(event);
      }}
    >
      <WasmProvider
        wasmUrl={wasmUrl}
        clientRef={client}
        sessionRef={session}
        latest={latest}
      >
        {children}
      </WasmProvider>
    </Renderer.Root>
  );
}

function WasmProvider({
  wasmUrl,
  clientRef,
  sessionRef,
  latest,
  children,
}: {
  wasmUrl: string | undefined;
  clientRef: RefObject<WasmClient | null>;
  sessionRef: RefObject<ToolSession | null>;
  latest: RefObject<{
    toolProvider: ToolProvider | undefined;
    fetchResource: ResourceFetcher | undefined;
    additionalImports: AdditionalImports | undefined;
    onRuntimeError: ((error: unknown) => void) | undefined;
  }>;
  children: ReactNode;
}) {
  const getFieldValue = useGetFieldValue();
  const setFieldValue = useSetFieldValue();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    const session = createToolSession(
      controller.signal,
      () => latest.current.toolProvider ?? {},
    );
    sessionRef.current = session;
    setReady(false);
    setError(undefined);
    const load = async () => {
      if (wasmUrl) {
        const loaded = await loadWasmClient(
          wasmUrl,
          controller.signal,
          {
            getValue(name) {
              controller.signal.throwIfAborted();
              const value = getFieldValue(undefined, name);
              return value === undefined ? undefined : JSON.stringify(value);
            },
            setValue(name, json) {
              controller.signal.throwIfAborted();
              setFieldValue(undefined, undefined, name, JSON.parse(json));
            },
          },
          {
            fetchResource: latest.current.fetchResource,
            additionalImports: latest.current.additionalImports,
            session,
            onError: (error) =>
              (latest.current.onRuntimeError ?? console.error)(error),
          },
        );
        if (controller.signal.aborted) return;
        clientRef.current = loaded;
      }
      if (!controller.signal.aborted) setReady(true);
    };
    void load().catch((cause) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
      (latest.current.onRuntimeError ?? console.error)(cause);
      controller.abort();
    });
    return () => {
      controller.abort();
      clientRef.current = null;
      sessionRef.current = null;
    };
  }, [wasmUrl, getFieldValue, setFieldValue, clientRef, sessionRef, latest]);
  if (error) return <p role="alert">Could not load UI: {error}</p>;
  if (!ready) return <p role="status">Loading OpenUI and WASM…</p>;
  return children;
}
