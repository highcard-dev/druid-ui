import type { BrowserImports } from "@druid-ui/client/types";

export type ConfirmHttpRequest = (url: string) => Promise<unknown>;
export interface HttpRequest {
  url: string;
  method?: string;
  headers?: HeadersInit;
  body?: string | Uint8Array<ArrayBuffer>;
}

const nativeConfirmation: ConfirmHttpRequest = async (url) => {
  if (
    !globalThis.confirm(
      `Allow this UI to fetch ${url}?\n\nCookies and Druid credentials are not included.`,
    )
  )
    throw new Error("HTTP request denied by user");
};

/** Shared by JSON host tools and typed WIT. Never uses authenticated package loaders. */
export async function requestHttp(
  { url, method = "GET", headers, body }: HttpRequest,
  signal: AbortSignal,
  confirm: ConfirmHttpRequest = nativeConfirmation,
): Promise<Response> {
  signal.throwIfAborted();
  if (!["http:", "https:"].includes(new URL(url).protocol))
    throw new Error("Use an HTTP(S) URL");
  try {
    await confirm(url);
  } catch (error) {
    throw error ?? new Error("HTTP request denied by user");
  }
  signal.throwIfAborted();
  const response = await fetch(url, {
    method,
    headers,
    body: /^(GET|HEAD)$/i.test(method) ? undefined : body,
    signal,
    credentials: "omit",
    mode: "cors",
  });
  if (!response.ok) throw new Error(`HTTP request failed (${response.status})`);
  return response;
}

export function http(
  signal: AbortSignal,
  confirm?: ConfirmHttpRequest,
): BrowserImports["druid:openui/http"] {
  return {
    async request({ url, method, headers, body }) {
      const response = await requestHttp(
        {
          url,
          method,
          headers,
          body: body && new Uint8Array(body),
        },
        signal,
        confirm,
      );
      return {
        status: response.status,
        headers: Array.from(response.headers.entries()),
        body: new Uint8Array(await response.arrayBuffer()),
      };
    },
  };
}
