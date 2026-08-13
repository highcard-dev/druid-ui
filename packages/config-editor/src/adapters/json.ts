import type { ConfigValue, FileSchema, ValidationIssue } from "../model.js";
import { splitSourceLines } from "./line-document.js";
import type { ConfigAdapter, LineNode, ParsedDocument, SourceSpan } from "./types.js";

interface JsonScalar {
  value: ConfigValue;
  span: SourceSpan;
}

export interface JsonDocument extends ParsedDocument {
  format: "json";
  scalars: ReadonlyMap<string, JsonScalar>;
  containers: ReadonlySet<string>;
}

class JsonParseError extends Error {
  readonly position: number;

  constructor(position: number, message: string) {
    super(message);
    this.position = position;
  }
}

const pointerSegment = (value: string): string =>
  value.replace(/~/g, "~0").replace(/\//g, "~1");

const locationAt = (source: string, position: number): { line: number; column: number } => {
  const before = source.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
};

const jsonNodes = (source: string): LineNode[] =>
  splitSourceLines(source).map((line) => ({
    ...line,
    kind: line.raw.trim() === "" ? "blank" : "invalid",
  }));

const parseJson = (source: string): JsonDocument => {
  const scalars = new Map<string, JsonScalar>();
  const containers = new Set<string>();
  let cursor = 0;

  const fail = (message: string): never => {
    throw new JsonParseError(cursor, message);
  };
  const skipWhitespace = (): void => {
    while (cursor < source.length && /\s/.test(source[cursor]!)) cursor += 1;
  };
  const consume = (character: string): void => {
    if (source[cursor] !== character) fail(`Expected "${character}".`);
    cursor += 1;
  };
  const parseString = (): { value: string; span: SourceSpan } => {
    const start = cursor;
    consume('"');
    while (cursor < source.length) {
      const character = source[cursor]!;
      if (character === '"') {
        cursor += 1;
        const token = source.slice(start, cursor);
        try {
          return { value: JSON.parse(token) as string, span: { start, end: cursor } };
        } catch {
          fail("Invalid JSON string.");
        }
      }
      if (character === "\\") {
        cursor += 2;
        continue;
      }
      if (character.charCodeAt(0) < 0x20) fail("Unescaped control character.");
      cursor += 1;
    }
    return fail("Unterminated JSON string.");
  };
  const parseValue = (pointer: string): void => {
    skipWhitespace();
    const start = cursor;
    const character = source[cursor];
    if (character === '"') {
      const string = parseString();
      scalars.set(pointer, { value: string.value, span: string.span });
      return;
    }
    if (character === "{") {
      containers.add(pointer);
      cursor += 1;
      skipWhitespace();
      if (source[cursor] === "}") {
        cursor += 1;
        return;
      }
      while (cursor < source.length) {
        skipWhitespace();
        if (source[cursor] !== '"') fail("Expected an object key.");
        const key = parseString().value;
        skipWhitespace();
        consume(":");
        parseValue(`${pointer}/${pointerSegment(key)}`);
        skipWhitespace();
        if (source[cursor] === "}") {
          cursor += 1;
          return;
        }
        consume(",");
      }
      fail("Unterminated JSON object.");
    }
    if (character === "[") {
      containers.add(pointer);
      cursor += 1;
      skipWhitespace();
      if (source[cursor] === "]") {
        cursor += 1;
        return;
      }
      let index = 0;
      while (cursor < source.length) {
        parseValue(`${pointer}/${index}`);
        index += 1;
        skipWhitespace();
        if (source[cursor] === "]") {
          cursor += 1;
          return;
        }
        consume(",");
      }
      fail("Unterminated JSON array.");
    }

    const remainder = source.slice(cursor);
    const literal = remainder.match(/^(?:true|false|null)(?![\w])/);
    if (literal) {
      cursor += literal[0].length;
      scalars.set(pointer, {
        value: JSON.parse(literal[0]) as ConfigValue,
        span: { start, end: cursor },
      });
      return;
    }
    const number = remainder.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      cursor += number[0].length;
      scalars.set(pointer, {
        value: Number(number[0]),
        span: { start, end: cursor },
      });
      return;
    }
    fail("Expected a JSON scalar, object, or array.");
  };

  try {
    parseValue("");
    skipWhitespace();
    if (cursor !== source.length) fail("Unexpected content after the JSON value.");
    return {
      format: "json",
      source,
      nodes: jsonNodes(source),
      issues: [],
      scalars,
      containers,
    };
  } catch (error) {
    if (!(error instanceof JsonParseError)) throw error;
    const location = locationAt(source, error.position);
    return {
      format: "json",
      source,
      nodes: jsonNodes(source),
      issues: [
        {
          code: "invalid-json",
          message: error.message,
          severity: "error",
          ...location,
        },
      ],
      scalars: new Map(),
      containers: new Set(),
    };
  }
};

export const jsonAdapter: ConfigAdapter<JsonDocument> = {
  parse: parseJson,
  get(document, key) {
    return document.scalars.get(key)?.value;
  },
  set(document, key, value) {
    if (document.issues.length > 0) throw new Error("Invalid JSON cannot be edited in form mode.");
    const scalar = document.scalars.get(key);
    if (!scalar) {
      if (document.containers.has(key)) throw new Error(`JSON pointer "${key}" is not a scalar.`);
      throw new Error(`JSON pointer "${key}" does not exist.`);
    }
    return parseJson(
      document.source.slice(0, scalar.span.start) +
        JSON.stringify(value) +
        document.source.slice(scalar.span.end),
    );
  },
  validate(document, schema: FileSchema): ValidationIssue[] {
    void schema;
    return [...document.issues];
  },
  serialize(document) {
    return document.source;
  },
};
