interface AuthOptions {
  type: "bearer" | "basic" | "api-key";
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
}

interface FileLoaderOptions {
  auth?: AuthOptions;
  headers?: Record<string, string>;
  cache?: boolean;
}

interface HttpResponse {
  buffer: ArrayBuffer;
  headers: Record<string, string>;
  contentType: string | null;
}

export interface FileLoader {
  load(path: string, options?: FileLoaderOptions): Promise<HttpResponse>;
}

export class HttpFileLoader {
  private authOptions?: AuthOptions | undefined;
  private defaultHeaders?: Record<string, string> | undefined;

  private baseUrl?: string | undefined;

  constructor(
    baseUrl?: string,
    authOptions?: AuthOptions,
    defaultHeaders?: Record<string, string>
  ) {
    this.baseUrl = baseUrl;
    this.authOptions = authOptions;
    this.defaultHeaders = defaultHeaders;
  }

  protected async loadHttp(
    path: string,
    options?: FileLoaderOptions
  ): Promise<HttpResponse> {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    // Use instance auth options if no options provided, or merge with provided options
    const authToUse = options?.auth || this.authOptions;

    // Add authentication headers
    if (authToUse) {
      switch (authToUse.type) {
        case "bearer":
          if (authToUse.token) {
            headers["Authorization"] = `Bearer ${authToUse.token}`;
          }
          break;
        case "basic":
          if (authToUse.username && authToUse.password) {
            const credentials = btoa(
              `${authToUse.username}:${authToUse.password}`
            );
            headers["Authorization"] = `Basic ${credentials}`;
          }
          break;
        case "api-key":
          if (authToUse.apiKey) {
            const headerName = authToUse.apiKeyHeader || "X-API-Key";
            headers[headerName] = authToUse.apiKey;
          }
          break;
      }
    }

    const res = await fetch(path, {
      headers,
      cache: options?.cache === false ? "no-store" : "default",
    });

    if (!res.ok) {
      throw new Error(`Failed to load file: ${path}, status: ${res.status}`);
    }

    // Extract all fetch-specific data
    const text = await res.arrayBuffer();

    const responseHeaders: Record<string, string> = {};
    // Handle both real Headers object and mocked headers
    if (res.headers && typeof res.headers.forEach === "function") {
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
    }

    const contentType = res.headers.get("Content-Type");

    return {
      buffer: text,
      headers: responseHeaders,
      contentType,
    };
  }

  async load(path: string, options?: FileLoaderOptions) {
    const filePath = this.baseUrl ? `${this.baseUrl}/${path}` : path;
    const response = await this.loadHttp(filePath, options);
    return response;
  }
}
