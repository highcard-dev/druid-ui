import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpFileLoader } from "../src/file-loader";
import { headers } from "happy-dom/lib/PropertySymbol.js";

const plainHeaderMock = (contentType = "text/plain") => ({
  get: (header: string) => (header === "Content-Type" ? contentType : null),
});

describe("HttpFileLoader", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let fileLoader: HttpFileLoader;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Basic file loading", () => {
    beforeEach(() => {
      fileLoader = new HttpFileLoader();
    });

    it("should load a file successfully", async () => {
      const expectedContent = "file content";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(expectedContent),
        headers: plainHeaderMock(),
      });

      const result = await fileLoader.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {},
      });
      expect(result.content).toBe(expectedContent);
    });

    it("should handle fetch errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fileLoader.load("missing.txt")).rejects.toThrow(
        "Failed to load file: missing.txt, status: 404"
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(fileLoader.load("test.txt")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("Authentication - Bearer Token", () => {
    beforeEach(() => {
      fileLoader = new HttpFileLoader(
        { type: "bearer", token: "test-token" },
        { "X-Custom": "header" }
      );
    });

    it("should include bearer token in headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await fileLoader.load("secure.txt");

      expect(mockFetch).toHaveBeenCalledWith("secure.txt", {
        headers: {
          "X-Custom": "header",
          Authorization: "Bearer test-token",
        },
      });
    });

    it("should handle missing bearer token", async () => {
      const loaderWithoutToken = new HttpFileLoader({ type: "bearer" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await loaderWithoutToken.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {},
      });
    });
  });

  describe("Authentication - Basic Auth", () => {
    beforeEach(() => {
      fileLoader = new HttpFileLoader({
        type: "basic",
        username: "user",
        password: "pass",
      });
    });

    it("should include basic auth in headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await fileLoader.load("protected.txt");

      // btoa("user:pass") = "dXNlcjpwYXNz"
      expect(mockFetch).toHaveBeenCalledWith("protected.txt", {
        headers: {
          Authorization: "Basic dXNlcjpwYXNz",
        },
      });
    });

    it("should handle missing credentials", async () => {
      const loaderWithoutCreds = new HttpFileLoader({
        type: "basic",
        username: "user",
        // missing password
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await loaderWithoutCreds.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {},
      });
    });
  });

  describe("Authentication - API Key", () => {
    beforeEach(() => {
      fileLoader = new HttpFileLoader({
        type: "api-key",
        apiKey: "secret-key",
      });
    });

    it("should include API key with default header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await fileLoader.load("api-endpoint");

      expect(mockFetch).toHaveBeenCalledWith("api-endpoint", {
        headers: {
          "X-API-Key": "secret-key",
        },
      });
    });

    it("should use custom API key header", async () => {
      const customLoader = new HttpFileLoader({
        type: "api-key",
        apiKey: "secret-key",
        apiKeyHeader: "X-Custom-API-Key",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await customLoader.load("api-endpoint");

      expect(mockFetch).toHaveBeenCalledWith("api-endpoint", {
        headers: {
          "X-Custom-API-Key": "secret-key",
        },
      });
    });

    it("should handle missing API key", async () => {
      const loaderWithoutKey = new HttpFileLoader({
        type: "api-key",
        // missing apiKey
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await loaderWithoutKey.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {},
      });
    });
  });

  describe("Options override", () => {
    beforeEach(() => {
      fileLoader = new HttpFileLoader(
        { type: "bearer", token: "default-token" },
        { "X-Default": "header" }
      );
    });

    it("should merge headers with options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await fileLoader.load("test.txt", {
        headers: { "X-Override": "value" },
      });

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {
          "X-Default": "header",
          "X-Override": "value",
          Authorization: "Bearer default-token",
        },
      });
    });

    it("should override auth with options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await fileLoader.load("test.txt", {
        auth: {
          type: "api-key",
          apiKey: "override-key",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {
          "X-Default": "header",
          "X-API-Key": "override-key",
        },
      });
    });

    it("should prioritize option headers over default headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await fileLoader.load("test.txt", {
        headers: { "X-Default": "overridden" },
      });

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {
          "X-Default": "overridden",
          Authorization: "Bearer default-token",
        },
      });
    });
  });

  describe("Constructor without parameters", () => {
    it("should work without auth or default headers", async () => {
      const basicLoader = new HttpFileLoader();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await basicLoader.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {},
      });
    });

    it("should work with only auth options", async () => {
      const authOnlyLoader = new HttpFileLoader({
        type: "bearer",
        token: "token123",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await authOnlyLoader.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {
          Authorization: "Bearer token123",
        },
      });
    });

    it("should work with only default headers", async () => {
      const headersOnlyLoader = new HttpFileLoader(undefined, {
        "Content-Type": "application/json",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue("content"),
        headers: plainHeaderMock(),
      });

      await headersOnlyLoader.load("test.txt");

      expect(mockFetch).toHaveBeenCalledWith("test.txt", {
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });

  describe("Error scenarios", () => {
    beforeEach(() => {
      fileLoader = new HttpFileLoader();
    });

    it("should handle different HTTP error statuses", async () => {
      const testCases = [
        { status: 400, expected: "Failed to load file: test.txt, status: 400" },
        { status: 401, expected: "Failed to load file: test.txt, status: 401" },
        { status: 403, expected: "Failed to load file: test.txt, status: 403" },
        { status: 500, expected: "Failed to load file: test.txt, status: 500" },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: testCase.status,
        });

        await expect(fileLoader.load("test.txt")).rejects.toThrow(
          testCase.expected
        );
      }
    });

    it("should handle text parsing errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockRejectedValue(new Error("Text parsing failed")),
      });

      await expect(fileLoader.load("test.txt")).rejects.toThrow(
        "Text parsing failed"
      );
    });
  });
});
