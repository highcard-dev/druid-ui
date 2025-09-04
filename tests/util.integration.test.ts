import { describe, it, expect } from "vitest";
import { dfunc } from "../src/util";
import type { FENode, Props } from "../src/types";

describe("Utility Functions Integration Tests", () => {
  describe("dfunc (DOM function)", () => {
    it("should create FENode with string selector", () => {
      const result = dfunc("div") as FENode;

      expect(result).toEqual({
        selector: "div",
        props: {},
        children: [],
      });
    });

    it("should handle selector with classes", () => {
      const result = dfunc("div.class1.class2") as FENode;

      expect(result).toEqual({
        selector: "div.class1.class2",
        props: {},
        children: [],
      });
    });

    it("should handle props as second argument", () => {
      const props: Props = { id: "test", onclick: () => {} };
      const result = dfunc("button", props) as FENode;

      expect(result).toEqual({
        selector: "button",
        props,
        children: [],
      });
    });

    it("should handle FENode content as second argument", () => {
      const childNode: FENode = {
        selector: "span",
        props: {},
        children: ["Child"],
      };
      const result = dfunc("div", childNode) as FENode;

      expect(result).toEqual({
        selector: "div",
        props: {},
        children: [childNode],
      });
    });

    it("should handle array of FENodes as second argument", () => {
      const childNodes: FENode[] = [
        { selector: "span", props: {}, children: ["Child 1"] },
        { selector: "span", props: {}, children: ["Child 2"] },
      ];
      const result = dfunc("div", childNodes) as FENode;

      expect(result).toEqual({
        selector: "div",
        props: {},
        children: childNodes,
      });
    });

    it("should handle props and string content together", () => {
      const props: Props = { class: "container" };
      const result = dfunc("div", props, "Content") as FENode;

      expect(result).toEqual({
        selector: "div",
        props,
        children: ["Content"],
      });
    });

    it("should handle props and array content together", () => {
      const props: Props = { id: "list" };
      const content = ["Item 1", "Item 2"];
      const result = dfunc("ul", props, content) as FENode;

      expect(result).toEqual({
        selector: "ul",
        props,
        children: content,
      });
    });

    it("should handle object with view method as selector", () => {
      const component = {
        view: () => "<div>Component</div>",
      };

      const result = dfunc(component);

      expect(result).toBe("<div>Component</div>");
    });

    it("should handle nested FENodes", () => {
      const childNode: FENode = {
        selector: "span",
        props: { class: "child" },
        children: ["Child Text"],
      };

      const result = dfunc("div", { class: "parent" }, [childNode]) as FENode;

      expect(result).toEqual({
        selector: "div",
        props: { class: "parent" },
        children: [childNode],
      });
    });

    it("should handle empty children when no content provided", () => {
      const result = dfunc("div", {}) as FENode;

      expect(result).toEqual({
        selector: "div",
        props: {},
        children: [],
      });
    });

    it("should differentiate between props and content correctly", () => {
      // Props object
      const props = { id: "test", class: "btn" };
      const result1 = dfunc("button", props) as FENode;

      expect(result1.props).toEqual(props);
      expect(result1.children).toEqual([]);

      // FENode content
      const childNode: FENode = {
        selector: "span",
        props: {},
        children: ["Click me"],
      };
      const result2 = dfunc("button", childNode) as FENode;

      expect(result2.props).toEqual({});
      expect(result2.children).toEqual([childNode]);
    });

    it("should handle complex nested structure", () => {
      const listItem1: FENode = {
        selector: "li",
        props: {},
        children: ["Item 1"],
      };

      const listItem2: FENode = {
        selector: "li",
        props: {},
        children: ["Item 2"],
      };

      const result = dfunc("ul", { class: "list" }, [
        listItem1,
        listItem2,
      ]) as FENode;

      expect(result).toEqual({
        selector: "ul",
        props: { class: "list" },
        children: [listItem1, listItem2],
      });
    });

    it("should handle single FENode as content parameter", () => {
      const childNode: FENode = {
        selector: "p",
        props: {},
        children: ["Paragraph content"],
      };

      const result = dfunc("div", {}, childNode) as FENode;

      expect(result).toEqual({
        selector: "div",
        props: {},
        children: [childNode],
      });
    });

    it("should handle string content as third parameter", () => {
      const result = dfunc("p", {}, "Hello World") as FENode;

      expect(result).toEqual({
        selector: "p",
        props: {},
        children: ["Hello World"],
      });
    });
  });
});
