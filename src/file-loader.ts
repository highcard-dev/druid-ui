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
  text: string;
  json: any;
  headers: Record<string, string>;
  contentType: string | null;
}

export interface FileLoader {
  load(path: string, options?: FileLoaderOptions): Promise<string>;
  loadEntrypoint(): Promise<Record<string, string>>;
}

export class HttpFileLoader {
  private authOptions?: AuthOptions | undefined;
  private defaultHeaders?: Record<string, string> | undefined;

  private entrypoint: string;
  private baseUrl?: string | undefined;

  constructor(
    entrypoint: string,
    authOptions?: AuthOptions,
    defaultHeaders?: Record<string, string>
  ) {
    this.entrypoint = entrypoint;
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
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not valid JSON, keep as null
    }

    const responseHeaders: Record<string, string> = {};
    // Handle both real Headers object and mocked headers
    if (res.headers && typeof res.headers.forEach === "function") {
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
    }

    const contentType = res.headers.get("Content-Type");

    return {
      text,
      json,
      headers: responseHeaders,
      contentType,
    };
  }

  async load(path: string, options?: FileLoaderOptions) {
    const response = await this.loadHttp(path, options);
    return response.text;
  }

  async loadEntrypoint() {
    const response = await this.loadHttp(this.entrypoint);
    const isIndex = response.contentType === "application/json";
    if (!isIndex) {
      this.baseUrl = undefined;
      return {
        "main.lua": response.text,
      };
    }

    this.baseUrl = this.entrypoint.split("/").slice(0, -1).join("/");
    const filesIndex: string[] = response.json;
    const files: Record<string, string> = {};
    await Promise.all(
      filesIndex.map(async (file) => {
        const filePath = `${this.baseUrl}/${file}`;

        files[file] = await this.load(filePath);
      })
    );
    return files;
  }
}
