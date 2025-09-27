import { describe, it, expect, vi } from "vitest";
import { dfunc } from "../src/util";
import type { VNode } from "snabbdom";

// Mock snabbdom's h function
vi.mock("snabbdom", () => ({
  h: vi.fn((selector, props, children) => ({
    sel: selector,
    data: props,
    children,
  })),
}));

describe("dfunc utility", () => {
  describe("Basic DOM creation", () => {
    it("should create a simple div element", () => {
      const result = dfunc("div", "Hello World") as VNode;

      expect(result).toEqual({
        sel: "div",
        data: {
          props: {},
          on: {},
        },
        children: "Hello World",
      });
    });

    it("should create element with CSS class selector", () => {
      const result = dfunc(".container", "Content") as VNode;

      expect(result).toEqual({
        sel: "div.container",
        data: {
          props: {},
          on: {},
        },
        children: "Content",
      });
    });

    it("should create element with ID selector", () => {
      const result = dfunc("#main", "Content") as VNode;

      expect(result).toEqual({
        sel: "div#main",
        data: {
          props: {},
          on: {},
        },
        children: "Content",
      });
    });

    it("should create element with complex selector", () => {
      const result = dfunc("span.highlight#important", "Text") as VNode;

      expect(result).toEqual({
        sel: "span.highlight#important",
        data: {
          props: {},
          on: {},
        },
        children: "Text",
      });
    });
  });

  describe("Props handling", () => {
    it("should handle simple props", () => {
      const props = {
        id: "test-id",
        className: "test-class",
        disabled: true,
      };

      const result = dfunc("input", props) as VNode;

      expect(result.data?.props).toEqual({
        id: "test-id",
        className: "test-class",
        disabled: true,
      });
    });

    it("should separate event handlers from props", () => {
      const props = {
        id: "test",
        onclick: vi.fn(),
        onchange: vi.fn(),
        disabled: false,
      };

      const result = dfunc("input", props) as VNode;

      expect(result.data?.props).toEqual({
        id: "test",
        disabled: false,
      });

      expect(result.data?.on).toHaveProperty("click");
      expect(result.data?.on).toHaveProperty("change");
    });

    it("should handle props with children as third parameter", () => {
      const props = { id: "test" };
      const children = "Child content";

      const result = dfunc("div", props, children) as VNode;

      expect(result.data?.props).toEqual({ id: "test" });
      expect(result.children).toBe(children);
    });
  });

  describe("Event handling", () => {
    it("should wrap event handlers correctly", () => {
      const mockHandler = vi.fn();
      const props = { onclick: mockHandler };

      const result = dfunc("button", props) as VNode;
      const clickHandler = result.data?.on?.click as any;

      expect(typeof clickHandler).toBe("function");

      // Simulate event
      const mockEvent = {
        target: {
          value: "test value",
          checked: true,
        },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      if (typeof clickHandler === "function") {
        clickHandler(mockEvent);
      }

      expect(mockHandler).toHaveBeenCalledWith({
        value: "test value",
        checked: true,
        preventDefault: expect.any(Function),
        stopPropagation: expect.any(Function),
      });
    });

    it("should handle multiple event handlers", () => {
      const clickHandler = vi.fn();
      const changeHandler = vi.fn();
      const keyupHandler = vi.fn();

      const props = {
        onclick: clickHandler,
        onchange: changeHandler,
        onkeyup: keyupHandler,
      };

      const result = dfunc("input", props) as VNode;

      expect(result.data?.on).toHaveProperty("click");
      expect(result.data?.on).toHaveProperty("change");
      expect(result.data?.on).toHaveProperty("keyup");
    });

    it("should extract event name correctly from different handlers", () => {
      const handlers = {
        onclick: vi.fn(),
        onmousedown: vi.fn(),
        onkeypress: vi.fn(),
        onfocus: vi.fn(),
        onblur: vi.fn(),
      };

      const result = dfunc("input", handlers) as VNode;

      expect(result.data?.on).toHaveProperty("click");
      expect(result.data?.on).toHaveProperty("mousedown");
      expect(result.data?.on).toHaveProperty("keypress");
      expect(result.data?.on).toHaveProperty("focus");
      expect(result.data?.on).toHaveProperty("blur");
    });
  });

  describe("Component rendering", () => {
    it("should handle component objects with view method", () => {
      const mockComponent = {
        view: vi.fn().mockReturnValue("rendered content"),
      };

      const props = { title: "Test Title" };
      const result = dfunc(mockComponent, props);

      expect(mockComponent.view).toHaveBeenCalledWith(props);
      expect(result).toBe("rendered content");
    });

    it("should handle component without props", () => {
      const mockComponent = {
        view: vi.fn().mockReturnValue("component output"),
      };

      const result = dfunc(mockComponent);

      expect(mockComponent.view).toHaveBeenCalledWith({});
      expect(result).toBe("component output");
    });

    it("should pass children as content to components", () => {
      const mockComponent = {
        view: vi.fn().mockReturnValue("component with children"),
      };

      const result = dfunc(mockComponent, "child content");

      expect(mockComponent.view).toHaveBeenCalledWith({});
      expect(result).toBe("component with children");
    });
  });

  describe("Array children", () => {
    it("should handle array of children", () => {
      const children = ["Hello", " ", "World"];
      const result = dfunc("div", children as any) as VNode;

      expect(result.children).toEqual(children);
    });

    it("should handle array children with props", () => {
      const props = { id: "container" };
      const children = ["Item 1", "Item 2"];

      const result = dfunc("ul", props, children as any) as VNode;

      expect(result.data?.props).toEqual(props);
      expect(result.children).toEqual(children);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty props", () => {
      const result = dfunc("div", {}) as VNode;

      expect(result.data?.props).toEqual({});
      expect(result.data?.on).toEqual({});
    });

    it("should handle null/undefined props", () => {
      const result1 = dfunc("div", null) as VNode;
      const result2 = dfunc("div", undefined) as VNode;

      expect(result1.data?.props).toEqual({});
      expect(result2.data?.props).toEqual({});
    });

    it("should handle mixed prop types", () => {
      const props = {
        string: "text",
        number: 42,
        boolean: true,
        onClick: vi.fn(),
        null: null,
        undefined: undefined,
      };

      const result = dfunc("div", props) as VNode;

      expect(result.data?.props).toEqual({
        string: "text",
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
      });

      expect(result.data?.on).toHaveProperty("click");
    });

    it("should handle complex selectors with class and id", () => {
      const result = dfunc("input.form-control#email-input") as VNode;

      expect(result.sel).toBe("input.form-control#email-input");
    });
  });
});
