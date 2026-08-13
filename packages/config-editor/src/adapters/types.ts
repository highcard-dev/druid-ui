import type {
  ConfigFormat,
  ConfigValue,
  FileSchema,
  ValidationIssue,
} from "../model.js";

export interface SourceSpan {
  start: number;
  end: number;
}

export interface SourceLine {
  raw: string;
  ending: "\n" | "\r\n" | "";
  start: number;
  end: number;
}

export interface LineNode extends SourceLine {
  kind:
    | "blank"
    | "comment"
    | "section"
    | "entry"
    | "continuation"
    | "invalid";
  key?: string;
  value?: string;
  valueSpan?: SourceSpan;
}

export interface ParsedDocument {
  format: ConfigFormat;
  source: string;
  nodes: readonly LineNode[];
  issues: readonly ValidationIssue[];
}

export interface ConfigAdapter<TDocument extends ParsedDocument = ParsedDocument> {
  parse(source: string): TDocument;
  get(document: TDocument, key: string): ConfigValue | undefined;
  set(document: TDocument, key: string, value: ConfigValue): TDocument;
  validate(document: TDocument, schema: FileSchema): ValidationIssue[];
  serialize(document: TDocument): string;
}
