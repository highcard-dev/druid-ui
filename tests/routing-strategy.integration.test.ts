import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  HistoryRoutingStrategy,
  CustomRoutingStrategy,
  createRoutingStrategy,
} from "../src/routing-strategy";

// Mock window object for history API
const mockWindow = {
  location: {
    pathname: "/",
  },
  history: {
    pushState: vi.fn(),
  },
};

Object.defineProperty(globalThis, "window", {
  value: mockWindow,
  writable: true,
});

describe("Routing Strategy Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow.location.pathname = "/";
  });

  describe("HistoryRoutingStrategy", () => {
    let strategy: HistoryRoutingStrategy;

    beforeEach(() => {
      strategy = new HistoryRoutingStrategy();
    });

    it("should get current path from window.location.pathname", () => {
      mockWindow.location.pathname = "/dashboard";

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/dashboard");
    });

    it("should navigate using history.pushState", () => {
      strategy.navigateTo("/profile");

      expect(mockWindow.history.pushState).toHaveBeenCalledWith(
        {},
        "",
        "/profile"
      );
    });

    it("should handle root path", () => {
      mockWindow.location.pathname = "/";

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/");
    });

    it("should handle complex paths", () => {
      const complexPath = "/users/123/profile";
      mockWindow.location.pathname = complexPath;

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe(complexPath);
    });

    it("should navigate to complex paths", () => {
      const targetPath = "/admin/dashboard/settings";

      strategy.navigateTo(targetPath);

      expect(mockWindow.history.pushState).toHaveBeenCalledWith(
        {},
        "",
        targetPath
      );
    });
  });

  describe("CustomRoutingStrategy", () => {
    let strategy: CustomRoutingStrategy;

    beforeEach(() => {
      strategy = new CustomRoutingStrategy();
    });

    it("should start with root path by default", () => {
      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/");
    });

    it("should update current path when navigating", () => {
      strategy.navigateTo("/dashboard");

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/dashboard");
    });

    it("should handle multiple navigation calls", () => {
      strategy.navigateTo("/users");
      expect(strategy.getCurrentPath()).toBe("/users");

      strategy.navigateTo("/settings");
      expect(strategy.getCurrentPath()).toBe("/settings");

      strategy.navigateTo("/");
      expect(strategy.getCurrentPath()).toBe("/");
    });

    it("should not affect browser history", () => {
      strategy.navigateTo("/test");

      expect(mockWindow.history.pushState).not.toHaveBeenCalled();
    });

    it("should handle empty string path", () => {
      strategy.navigateTo("");

      expect(strategy.getCurrentPath()).toBe("");
    });

    it("should handle special characters in path", () => {
      const specialPath = "/search?q=test&filter=true#results";

      strategy.navigateTo(specialPath);

      expect(strategy.getCurrentPath()).toBe(specialPath);
    });
  });

  describe("createRoutingStrategy factory", () => {
    it('should create HistoryRoutingStrategy for "history" mode', () => {
      const strategy = createRoutingStrategy("history");

      expect(strategy).toBeInstanceOf(HistoryRoutingStrategy);
    });

    it('should create CustomRoutingStrategy for "custom" mode', () => {
      const strategy = createRoutingStrategy("custom");

      expect(strategy).toBeInstanceOf(CustomRoutingStrategy);
    });

    it("should have proper interface implementation for history strategy", () => {
      const strategy = createRoutingStrategy("history");

      expect(typeof strategy.getCurrentPath).toBe("function");
      expect(typeof strategy.navigateTo).toBe("function");
    });

    it("should have proper interface implementation for custom strategy", () => {
      const strategy = createRoutingStrategy("custom");

      expect(typeof strategy.getCurrentPath).toBe("function");
      expect(typeof strategy.navigateTo).toBe("function");
    });

    it("should work with both strategies interchangeably", () => {
      const historyStrategy = createRoutingStrategy("history");
      const customStrategy = createRoutingStrategy("custom");

      // Both should implement the same interface
      historyStrategy.navigateTo("/test");
      customStrategy.navigateTo("/test");

      expect(typeof historyStrategy.getCurrentPath()).toBe("string");
      expect(typeof customStrategy.getCurrentPath()).toBe("string");
    });
  });

  describe("Strategy Interface Compatibility", () => {
    it("should maintain consistent interface across both strategies", () => {
      const historyStrategy = createRoutingStrategy("history");
      const customStrategy = createRoutingStrategy("custom");

      // Test that both have the same methods
      expect(historyStrategy.getCurrentPath).toBeDefined();
      expect(historyStrategy.navigateTo).toBeDefined();
      expect(customStrategy.getCurrentPath).toBeDefined();
      expect(customStrategy.navigateTo).toBeDefined();
    });

    it("should handle switching between strategies", () => {
      let strategy = createRoutingStrategy("custom");
      strategy.navigateTo("/test1");
      expect(strategy.getCurrentPath()).toBe("/test1");

      // Switch to history strategy
      strategy = createRoutingStrategy("history");
      mockWindow.location.pathname = "/test2";
      expect(strategy.getCurrentPath()).toBe("/test2");
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined or null navigation gracefully", () => {
      const strategy = createRoutingStrategy("custom");

      // These should not throw errors
      expect(() => strategy.navigateTo(undefined as any)).not.toThrow();
      expect(() => strategy.navigateTo(null as any)).not.toThrow();
    });

    it("should handle very long paths", () => {
      const longPath = "/" + "a".repeat(1000);
      const strategy = createRoutingStrategy("custom");

      strategy.navigateTo(longPath);

      expect(strategy.getCurrentPath()).toBe(longPath);
    });

    it("should handle paths with query parameters and fragments", () => {
      const strategy = createRoutingStrategy("custom");
      const complexPath = "/page?param1=value1&param2=value2#section";

      strategy.navigateTo(complexPath);

      expect(strategy.getCurrentPath()).toBe(complexPath);
    });
  });
});
