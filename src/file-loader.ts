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
}

export type FileLoader = (
  path: string,
  options?: FileLoaderOptions
) => Promise<string>;

export class HttpFileLoader {
  private authOptions?: AuthOptions | undefined;
  private defaultHeaders?: Record<string, string> | undefined;

  constructor(
    authOptions?: AuthOptions,
    defaultHeaders?: Record<string, string>
  ) {
    this.authOptions = authOptions;
    this.defaultHeaders = defaultHeaders;
  }

  async load(path: string, options?: FileLoaderOptions): Promise<string> {
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

    const res = await fetch(path, { headers });
    if (!res.ok) {
      throw new Error(`Failed to load file: ${path}, status: ${res.status}`);
    }
    return res.text();
  }
}
