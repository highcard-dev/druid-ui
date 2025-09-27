import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HistoryRoutingStrategy,
  CustomRoutingStrategy,
  createRoutingStrategy,
  type RoutingStrategy,
} from "../src/routing-strategy";

describe("RoutingStrategy", () => {
  describe("HistoryRoutingStrategy", () => {
    let strategy: HistoryRoutingStrategy;
    let originalLocation: Location;
    let originalHistory: History;

    beforeEach(() => {
      strategy = new HistoryRoutingStrategy();

      // Mock window.location
      originalLocation = window.location;
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          ...originalLocation,
          pathname: "/",
        },
      });

      // Mock window.history
      originalHistory = window.history;
      Object.defineProperty(window, "history", {
        writable: true,
        value: {
          ...originalHistory,
          pushState: vi.fn(),
        },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
      Object.defineProperty(window, "history", {
        writable: true,
        value: originalHistory,
      });
      vi.resetAllMocks();
    });

    it("should get current path from window.location.pathname", () => {
      window.location.pathname = "/home";

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/home");
    });

    it("should get root path when at root", () => {
      window.location.pathname = "/";

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/");
    });

    it("should get nested paths", () => {
      window.location.pathname = "/users/123/profile";

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/users/123/profile");
    });

    it("should navigate using history.pushState", () => {
      const newPath = "/about";

      strategy.navigateTo(newPath);

      expect(window.history.pushState).toHaveBeenCalledWith({}, "", newPath);
    });

    it("should navigate to complex paths", () => {
      const complexPath = "/users/123/settings?tab=security";

      strategy.navigateTo(complexPath);

      expect(window.history.pushState).toHaveBeenCalledWith(
        {},
        "",
        complexPath
      );
    });

    it("should handle empty path navigation", () => {
      strategy.navigateTo("");

      expect(window.history.pushState).toHaveBeenCalledWith({}, "", "");
    });
  });

  describe("CustomRoutingStrategy", () => {
    let strategy: CustomRoutingStrategy;

    beforeEach(() => {
      strategy = new CustomRoutingStrategy();
    });

    it("should initialize with root path", () => {
      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/");
    });

    it("should update path when navigating", () => {
      strategy.navigateTo("/dashboard");

      const currentPath = strategy.getCurrentPath();

      expect(currentPath).toBe("/dashboard");
    });

    it("should handle multiple navigation calls", () => {
      strategy.navigateTo("/users");
      expect(strategy.getCurrentPath()).toBe("/users");

      strategy.navigateTo("/users/123");
      expect(strategy.getCurrentPath()).toBe("/users/123");

      strategy.navigateTo("/");
      expect(strategy.getCurrentPath()).toBe("/");
    });

    it("should handle complex paths", () => {
      const complexPath = "/api/v1/users?sort=name&limit=10";

      strategy.navigateTo(complexPath);

      expect(strategy.getCurrentPath()).toBe(complexPath);
    });

    it("should handle empty string navigation", () => {
      strategy.navigateTo("/home");
      strategy.navigateTo("");

      expect(strategy.getCurrentPath()).toBe("");
    });

    it("should not affect window.location", () => {
      const originalPathname = window.location.pathname;

      strategy.navigateTo("/custom-route");

      expect(window.location.pathname).toBe(originalPathname);
      expect(strategy.getCurrentPath()).toBe("/custom-route");
    });
  });

  describe("createRoutingStrategy factory", () => {
    let originalLocation: Location;
    let originalHistory: History;

    beforeEach(() => {
      // Mock window objects for HistoryRoutingStrategy tests
      originalLocation = window.location;
      originalHistory = window.history;

      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          ...originalLocation,
          pathname: "/test",
        },
      });

      Object.defineProperty(window, "history", {
        writable: true,
        value: {
          ...originalHistory,
          pushState: vi.fn(),
        },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      });
      Object.defineProperty(window, "history", {
        writable: true,
        value: originalHistory,
      });
    });

    it("should create HistoryRoutingStrategy for 'history' mode", () => {
      const strategy = createRoutingStrategy("history");

      expect(strategy).toBeInstanceOf(HistoryRoutingStrategy);
      expect(strategy.getCurrentPath()).toBe("/test");
    });

    it("should create CustomRoutingStrategy for 'custom' mode", () => {
      const strategy = createRoutingStrategy("custom");

      expect(strategy).toBeInstanceOf(CustomRoutingStrategy);
      expect(strategy.getCurrentPath()).toBe("/");
    });

    it("should default to HistoryRoutingStrategy for unknown modes", () => {
      const strategy = createRoutingStrategy("unknown" as any);

      expect(strategy).toBeInstanceOf(HistoryRoutingStrategy);
    });

    it("should create strategies with proper interface", () => {
      const historyStrategy = createRoutingStrategy("history");
      const customStrategy = createRoutingStrategy("custom");

      // Check that both implement the RoutingStrategy interface
      expect(typeof historyStrategy.getCurrentPath).toBe("function");
      expect(typeof historyStrategy.navigateTo).toBe("function");

      expect(typeof customStrategy.getCurrentPath).toBe("function");
      expect(typeof customStrategy.navigateTo).toBe("function");
    });
  });

  describe("RoutingStrategy interface compliance", () => {
    const strategies: { name: string; strategy: RoutingStrategy }[] = [
      {
        name: "HistoryRoutingStrategy",
        strategy: new HistoryRoutingStrategy(),
      },
      { name: "CustomRoutingStrategy", strategy: new CustomRoutingStrategy() },
    ];

    // Mock window objects for this test suite
    beforeEach(() => {
      const originalLocation = window.location;

      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          ...originalLocation,
          pathname: "/interface-test",
        },
      });

      Object.defineProperty(window, "history", {
        writable: true,
        value: {
          ...window.history,
          pushState: vi.fn(),
        },
      });
    });

    strategies.forEach(({ name, strategy }) => {
      describe(name, () => {
        it("should have getCurrentPath method", () => {
          expect(typeof strategy.getCurrentPath).toBe("function");
          expect(typeof strategy.getCurrentPath()).toBe("string");
        });

        it("should have navigateTo method", () => {
          expect(typeof strategy.navigateTo).toBe("function");

          // Should not throw when called
          expect(() => strategy.navigateTo("/test-path")).not.toThrow();
        });

        it("should maintain path state consistently", () => {
          const testPath = "/consistent-test";

          strategy.navigateTo(testPath);

          if (strategy instanceof CustomRoutingStrategy) {
            // CustomRoutingStrategy should track its own state
            expect(strategy.getCurrentPath()).toBe(testPath);
          }
          // Note: HistoryRoutingStrategy behavior depends on actual window.location
        });
      });
    });
  });

  describe("Edge cases and error handling", () => {
    describe("HistoryRoutingStrategy edge cases", () => {
      let strategy: HistoryRoutingStrategy;

      beforeEach(() => {
        strategy = new HistoryRoutingStrategy();

        // Mock window.history.pushState to potentially throw
        Object.defineProperty(window, "history", {
          writable: true,
          value: {
            ...window.history,
            pushState: vi.fn(),
          },
        });
      });

      it("should handle pushState errors gracefully", () => {
        // Mock pushState to throw an error
        Object.defineProperty(window, "history", {
          writable: true,
          value: {
            ...window.history,
            pushState: vi.fn().mockImplementation(() => {
              throw new Error("PushState failed");
            }),
          },
        });

        // Should throw the pushState error since it's not caught
        expect(() => strategy.navigateTo("/error-test")).toThrow(
          "PushState failed"
        );
      });
    });

    describe("CustomRoutingStrategy edge cases", () => {
      let strategy: CustomRoutingStrategy;

      beforeEach(() => {
        strategy = new CustomRoutingStrategy();
      });

      it("should handle null/undefined paths", () => {
        // TypeScript would prevent this, but testing runtime behavior
        strategy.navigateTo(null as any);
        expect(strategy.getCurrentPath()).toBe(null);

        strategy.navigateTo(undefined as any);
        expect(strategy.getCurrentPath()).toBe(undefined);
      });

      it("should handle special characters in paths", () => {
        const specialPath = "/test?query=value&other=123#fragment";

        strategy.navigateTo(specialPath);

        expect(strategy.getCurrentPath()).toBe(specialPath);
      });

      it("should handle Unicode characters", () => {
        const unicodePath = "/тест/пользователь/设置";

        strategy.navigateTo(unicodePath);

        expect(strategy.getCurrentPath()).toBe(unicodePath);
      });
    });
  });
});
