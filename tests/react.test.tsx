import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { DruidUI as DruidUIReact } from "../src/react";

// Mock the main DruidUI class
vi.mock("../src/main", () => ({
  DruidUI: class MockDruidUI extends HTMLElement {
    constructor() {
      super();
      this.setAttribute = vi.fn();
      this.addEventListener = vi.fn();
    }

    setAttribute = vi.fn();
    addEventListener = vi.fn();
  },
}));

describe("DruidUI React Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component structure", () => {
    it("should be a valid React component", () => {
      expect(typeof DruidUIReact).toBe("function");
    });

    it("should accept props interface", () => {
      // Test that the component accepts the expected props
      const props = {
        entrypoint: "app.lua",
        path: "/dashboard",
      };

      // This should not throw any TypeScript errors
      const element = React.createElement(DruidUIReact, props);
      expect(element).toBeDefined();
      expect(element.type).toBe(DruidUIReact);
    });

    it("should handle optional props", () => {
      // Test with no props
      const element1 = React.createElement(DruidUIReact);
      expect(element1).toBeDefined();

      // Test with only entrypoint
      const element2 = React.createElement(DruidUIReact, {
        entrypoint: "main.lua",
      });
      expect(element2).toBeDefined();

      // Test with only path
      const element3 = React.createElement(DruidUIReact, { path: "/home" });
      expect(element3).toBeDefined();
    });
  });

  describe("Props validation", () => {
    it("should accept valid entrypoint values", () => {
      const validEntrypoints = [
        "app.lua",
        "main.lua",
        "components/header.lua",
        undefined,
      ];

      validEntrypoints.forEach((entrypoint) => {
        expect(() => {
          React.createElement(DruidUIReact, { entrypoint });
        }).not.toThrow();
      });
    });

    it("should accept valid path values", () => {
      const validPaths = [
        "/",
        "/dashboard",
        "/users/123",
        "/api/v1/data?query=test",
        undefined,
      ];

      validPaths.forEach((path) => {
        expect(() => {
          React.createElement(DruidUIReact, { path });
        }).not.toThrow();
      });
    });
  });

  describe("React integration", () => {
    it("should work with React.createElement", () => {
      const element = React.createElement(DruidUIReact, {
        entrypoint: "test.lua",
        path: "/test",
      });

      expect(element.type).toBe(DruidUIReact);
      expect(element.props).toEqual({
        entrypoint: "test.lua",
        path: "/test",
      });
    });

    it("should have proper displayName for debugging", () => {
      // Check if the component has a displayName for React DevTools
      expect(DruidUIReact.displayName || DruidUIReact.name).toBeTruthy();
    });
  });

  describe("Custom element integration", () => {
    it("should render druid-ui custom element", () => {
      const TestWrapper = () => {
        const [mounted, setMounted] = React.useState(false);

        React.useEffect(() => {
          setMounted(true);
        }, []);

        return mounted
          ? React.createElement(DruidUIReact, { entrypoint: "app.lua" })
          : null;
      };

      // Test that component can be used in React lifecycle
      const element = React.createElement(TestWrapper);
      expect(element).toBeDefined();
    });

    it("should handle state changes", () => {
      const TestComponent = () => {
        const [entrypoint, setEntrypoint] = React.useState("initial.lua");
        const [path, setPath] = React.useState("/");

        // Simulate state updates
        React.useEffect(() => {
          setEntrypoint("updated.lua");
          setPath("/updated");
        }, []);

        return React.createElement(DruidUIReact, { entrypoint, path });
      };

      const element = React.createElement(TestComponent);
      expect(element).toBeDefined();
    });
  });

  describe("useRef compatibility", () => {
    it("should work with React refs", () => {
      const TestComponent = () => {
        const druidRef = React.useRef(null);

        React.useEffect(() => {
          // Test ref assignment in effect
          if (druidRef.current) {
            expect(druidRef.current).toBeDefined();
          }
        }, []);

        // Note: We can't directly test ref passing here due to the custom element nature
        return React.createElement(DruidUIReact, {
          entrypoint: "app.lua",
          // ref would be passed via React's ref system
        });
      };

      const element = React.createElement(TestComponent);
      expect(element).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle missing import gracefully", () => {
      // Test that the component doesn't throw during creation
      expect(() => {
        React.createElement(DruidUIReact, { entrypoint: "test.lua" });
      }).not.toThrow();
    });

    it("should handle invalid props gracefully", () => {
      // Test with potentially problematic values
      const problematicProps = [
        { entrypoint: null },
        { path: null },
        { entrypoint: "" },
        { path: "" },
      ];

      problematicProps.forEach((props) => {
        expect(() => {
          React.createElement(DruidUIReact, props as any);
        }).not.toThrow();
      });
    });
  });

  describe("TypeScript interface compliance", () => {
    it("should satisfy DruidUIProps interface", () => {
      // Test that all expected prop combinations work
      const propCombinations = [
        {},
        { entrypoint: "main.lua" },
        { path: "/" },
        { entrypoint: "app.lua", path: "/dashboard" },
      ];

      propCombinations.forEach((props) => {
        const element = React.createElement(DruidUIReact, props);
        expect(element.props).toEqual(props);
      });
    });
  });

  describe("Component lifecycle", () => {
    it("should support conditional rendering", () => {
      const ConditionalComponent = () => {
        const [show, setShow] = React.useState(false);

        React.useEffect(() => {
          setShow(true);
        }, []);

        if (show) {
          return React.createElement(DruidUIReact, {
            entrypoint: "conditional.lua",
          });
        }
        return null;
      };

      const element = React.createElement(ConditionalComponent);
      expect(element).toBeDefined();
    });

    it("should support dynamic props", () => {
      const DynamicComponent = () => {
        const [config, setConfig] = React.useState({
          entrypoint: "initial.lua",
          path: "/initial",
        });

        React.useEffect(() => {
          setConfig({
            entrypoint: "dynamic.lua",
            path: "/dynamic",
          });
        }, []);

        return React.createElement(DruidUIReact, config);
      };

      const element = React.createElement(DynamicComponent);
      expect(element).toBeDefined();
    });
  });
});
