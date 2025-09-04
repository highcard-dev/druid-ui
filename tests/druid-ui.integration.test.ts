import { describe, it, expect, beforeEach, vi } from "vitest";
import { DruidUI, HttpFileLoader } from "../src/main";

// Mock the Lua file content for testing
const mockLuaContent = `
local sp = "Test content"

TestComponent = {
    oninit = function ()
        print("Test component initialized")
    end,
    view = function ()
        return d("div", {
            d("p", {}, sp),
            d("button", {
                onclick = function ()
                    sp = "Updated content"
                end,
            }, "Update"),
        })
    end,
}
mount(TestComponent)
`;

describe("DruidUI Integration Tests", () => {
  let druidElement: DruidUI;
  let mockFileLoader: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock file loader
    mockFileLoader = {
      load: vi.fn(),
    };

    // Create a fresh DruidUI element
    druidElement = new DruidUI();
    druidElement.fileloader = mockFileLoader;
    document.body.appendChild(druidElement);
  });

  describe("Custom Element Registration", () => {
    it("should be registered as a custom element", () => {
      expect(customElements.get("druid-ui")).toBeDefined();
    });

    it("should create a shadow DOM", () => {
      expect(druidElement.shadowRoot).toBeDefined();
    });

    it("should have a mount element in shadow DOM", () => {
      const mountEl = druidElement.shadowRoot?.querySelector("div");
      expect(mountEl).toBeDefined();
    });
  });

  describe("Attribute Handling", () => {
    it("should handle entrypoint attribute", async () => {
      mockFileLoader.load.mockResolvedValueOnce(mockLuaContent);

      druidElement.setAttribute("entrypoint", "test.lua");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFileLoader.load).toHaveBeenCalledWith("test.lua");
    });

    it("should handle CSS attribute", () => {
      const cssUrl = "https://example.com/style.css";
      druidElement.setAttribute("css", cssUrl);

      const linkElement = druidElement.shadowRoot?.querySelector(
        'link[rel="stylesheet"]'
      );
      expect(linkElement?.getAttribute("href")).toBe(cssUrl);
    });

    it("should handle custom style attribute", () => {
      const customStyle = "body { background: red; }";
      druidElement.setAttribute("style", customStyle);

      const styleElement = druidElement.shadowRoot?.querySelector("style");
      expect(styleElement?.textContent?.trim()).toBe(customStyle);
    });

    it("should handle profile attribute", () => {
      druidElement.setAttribute("profile", "true");
      expect(druidElement["profile"]).toBe(true);
    });
  });

  describe("File Loading", () => {
    it("should load Lua files from HTTP", async () => {
      mockFileLoader.load.mockResolvedValueOnce(mockLuaContent);

      druidElement.setAttribute("entrypoint", "app.lua");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFileLoader.load).toHaveBeenCalledWith("app.lua");
    });

    it("should handle JSON bundle files", async () => {
      const jsonBundle = JSON.stringify(["main.lua", "utils.lua"]);
      const mainLua = "mount(TestComponent)";
      const utilsLua = "function test() end";

      mockFileLoader.load
        .mockResolvedValueOnce(jsonBundle)
        .mockResolvedValueOnce(mainLua)
        .mockResolvedValueOnce(utilsLua);

      druidElement.setAttribute("entrypoint", "bundle.json");

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockFileLoader.load).toHaveBeenCalledTimes(3);
      expect(mockFileLoader.load).toHaveBeenCalledWith("bundle.json");
      expect(mockFileLoader.load).toHaveBeenCalledWith("/main.lua");
      expect(mockFileLoader.load).toHaveBeenCalledWith("/utils.lua");
    });

    it("should handle fetch errors gracefully", async () => {
      mockFileLoader.load.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw when entrypoint fails to load
      expect(() => {
        druidElement.setAttribute("entrypoint", "nonexistent.lua");
      }).not.toThrow();

      // Wait for async operations and handle the expected rejection
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
  });

  describe("Routing Strategy", () => {
    it("should use history routing by default", () => {
      expect(druidElement["routingStrategy"]).toBeDefined();
      expect(druidElement["routingStrategy"].getCurrentPath()).toBe(
        window.location.pathname
      );
    });

    it("should support custom routing strategy", () => {
      druidElement.setAttribute("routing-strategy", "custom");
      expect(druidElement["routingStrategy"]).toBeDefined();
    });
  });

  describe("Event Handling", () => {
    it("should dispatch init event when Lua engine is ready", async () => {
      let initEventFired = false;

      druidElement.addEventListener("init", (e) => {
        initEventFired = true;
        expect(e).toBeInstanceOf(CustomEvent);
      });

      mockFileLoader.load.mockResolvedValueOnce(mockLuaContent);

      druidElement.setAttribute("entrypoint", "test.lua");

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(initEventFired).toBe(true);
    });
  });

  describe("CSS Variable Management", () => {
    it("should set CSS variables with setCSSVariable method", () => {
      druidElement.setCSSVariable("--test-color", "#ff0000");

      const mountEl = druidElement.shadowRoot?.querySelector("div");
      expect(mountEl?.style.getPropertyValue("--test-color")).toBe("#ff0000");
    });

    it("should handle colors property setter", () => {
      druidElement.colors = {
        primary: "#blue",
        secondary: "#green",
      };

      const mountEl = druidElement.shadowRoot?.querySelector("div");
      expect(mountEl?.style.getPropertyValue("--color-primary")).toBe("#blue");
      expect(mountEl?.style.getPropertyValue("--color-secondary")).toBe(
        "#green"
      );
    });
  });

  describe("Reload Functionality", () => {
    it("should support reloading individual files", async () => {
      mockFileLoader.load.mockResolvedValue(mockLuaContent);

      druidElement.setAttribute("entrypoint", "main.lua");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear previous calls
      mockFileLoader.load.mockClear();

      // Reload a specific file
      await druidElement.reload("component.lua");

      expect(mockFileLoader.load).toHaveBeenCalledWith("component.lua");
    });
  });
});
