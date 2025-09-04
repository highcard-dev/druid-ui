// Test setup file for global configurations
import { beforeEach, afterEach, vi } from "vitest";

// Setup DOM environment
beforeEach(() => {
  // Clear any existing custom elements between tests
  document.body.innerHTML = "";
});

afterEach(() => {
  // Clean up after each test
  document.body.innerHTML = "";
});

// Mock fetch for testing
Object.defineProperty(globalThis, "fetch", {
  value: vi.fn(),
  writable: true,
});

// Mock wasmoon for testing
vi.mock("wasmoon", () => ({
  LuaFactory: vi.fn(() => ({
    createEngine: vi.fn().mockResolvedValue({
      global: {
        set: vi.fn(),
      },
      doString: vi.fn(),
      doFile: vi.fn(),
    }),
    mountFile: vi.fn(),
  })),
}));

// Mock morphdom
vi.mock("morphdom", () => ({
  default: vi.fn((from, to, options) => {
    // Simple mock implementation
    if (options?.onBeforeElUpdated) {
      options.onBeforeElUpdated(from, to);
    }
    return from;
  }),
}));
