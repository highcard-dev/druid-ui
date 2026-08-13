import type { ConfigFormat, ConfigValue, FileSchema, ValidationIssue } from "../model.js";
import { hasFinalNewline, preferredLineEnding, splitSourceLines } from "./line-document.js";
import type {
  ConfigAdapter,
  LineNode,
  ParsedDocument,
  SourceSpan,
} from "./types.js";

interface IniEntry {
  key: string;
  value: string;
  valueSpan: SourceSpan;
  line: number;
}

interface IniSection {
  name: string;
  line: number;
}

export interface IniDocument extends ParsedDocument {
  format: "ini" | "unreal-ini" | "key-value";
  entries: readonly IniEntry[];
  sections: readonly IniSection[];
  lineEnding: "\n" | "\r\n";
  finalNewline: boolean;
}

const inlineCommentAt = (value: string): number => {
  for (let index = 0; index < value.length; index += 1) {
    const precededBySpace = index > 0 && /\s/.test(value[index - 1]!);
    if (!precededBySpace) continue;
    if (value[index] === ";" || value[index] === "#") return index;
    if (value[index] === "/" && value[index + 1] === "/") return index;
  }
  return value.length;
};

const parseEntryLine = (
  raw: string,
  start: number,
  section: string | undefined,
  line: number,
): IniEntry | undefined => {
  let keyStart = 0;
  while (keyStart < raw.length && /[ \t]/.test(raw[keyStart]!)) keyStart += 1;
  if (keyStart === raw.length) return undefined;

  let keyEnd = keyStart;
  while (
    keyEnd < raw.length &&
    raw[keyEnd] !== "=" &&
    raw[keyEnd] !== ":" &&
    !/[ \t]/.test(raw[keyEnd]!)
  ) {
    keyEnd += 1;
  }
  if (keyEnd === keyStart) return undefined;

  let valueStart = keyEnd;
  while (valueStart < raw.length && /[ \t]/.test(raw[valueStart]!)) valueStart += 1;
  if (raw[valueStart] === "=" || raw[valueStart] === ":") valueStart += 1;
  while (valueStart < raw.length && /[ \t]/.test(raw[valueStart]!)) valueStart += 1;

  const comment = inlineCommentAt(raw.slice(valueStart));
  let valueEnd = valueStart + comment;
  while (valueEnd > valueStart && /[ \t]/.test(raw[valueEnd - 1]!)) valueEnd -= 1;
  const localKey = raw.slice(keyStart, keyEnd).trim();
  return {
    key: section ? `${section}.${localKey}` : localKey,
    value: raw.slice(valueStart, valueEnd),
    valueSpan: { start: start + valueStart, end: start + valueEnd },
    line,
  };
};

const parseIni = (
  source: string,
  format: IniDocument["format"],
): IniDocument => {
  const lines = splitSourceLines(source);
  const entries: IniEntry[] = [];
  const sections: IniSection[] = [];
  const nodes: LineNode[] = [];
  let section: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const trimmed = line.raw.trimStart();
    if (trimmed === "") {
      nodes.push({ ...line, kind: "blank" });
      continue;
    }
    if (
      trimmed.startsWith(";") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("//")
    ) {
      nodes.push({ ...line, kind: "comment" });
      continue;
    }

    const sectionMatch = format === "key-value" ? null : trimmed.match(/^\[([^\]]+)](?:\s*(?:[;#].*)?)$/);
    if (sectionMatch) {
      section = sectionMatch[1]!.trim();
      sections.push({ name: section, line: index });
      nodes.push({ ...line, kind: "section" });
      continue;
    }

    const entry = parseEntryLine(line.raw, line.start, section, index);
    if (entry) {
      entries.push(entry);
      nodes.push({
        ...line,
        kind: "entry",
        key: entry.key,
        value: entry.value,
        valueSpan: entry.valueSpan,
      });
    } else nodes.push({ ...line, kind: "invalid" });
  }

  return {
    format,
    source,
    nodes,
    entries,
    sections,
    issues: [],
    lineEnding: preferredLineEnding(lines),
    finalNewline: hasFinalNewline(source),
  };
};

const effectiveEntry = (document: IniDocument, key: string): IniEntry | undefined => {
  for (let index = document.entries.length - 1; index >= 0; index -= 1) {
    const entry = document.entries[index]!;
    if (entry.key === key) return entry;
  }
  return undefined;
};

const formatValue = (value: ConfigValue): string =>
  (value === null ? "" : String(value)).replace(/[\r\n]/g, (character) =>
    character === "\r" ? "\\r" : "\\n",
  );

const appendIniEntry = (
  document: IniDocument,
  key: string,
  value: ConfigValue,
): string => {
  const split = document.format === "key-value" ? -1 : key.lastIndexOf(".");
  const section = split < 0 ? undefined : key.slice(0, split);
  const localKey = split < 0 ? key : key.slice(split + 1);
  const assignment = `${localKey}=${formatValue(value)}`;
  const prefix = document.source === "" || document.finalNewline ? "" : document.lineEnding;
  const suffix = document.finalNewline ? document.lineEnding : "";

  if (!section || document.sections.some((candidate) => candidate.name === section)) {
    return `${document.source}${prefix}${assignment}${suffix}`;
  }
  const sectionHeader = `[${section}]${document.lineEnding}`;
  return `${document.source}${prefix}${sectionHeader}${assignment}${suffix}`;
};

const createIniAdapter = (
  format: IniDocument["format"],
): ConfigAdapter<IniDocument> => ({
  parse(source) {
    return parseIni(source, format);
  },
  get(document, key) {
    return effectiveEntry(document, key)?.value;
  },
  set(document, key, value) {
    const entry = effectiveEntry(document, key);
    if (!entry) return parseIni(appendIniEntry(document, key, value), format);
    return parseIni(
      document.source.slice(0, entry.valueSpan.start) +
        formatValue(value) +
        document.source.slice(entry.valueSpan.end),
      format,
    );
  },
  validate(document, schema: FileSchema): ValidationIssue[] {
    void schema;
    return [...document.issues];
  },
  serialize(document) {
    return document.source;
  },
});

export const iniAdapter = createIniAdapter("ini");
export const unrealIniAdapter = createIniAdapter("unreal-ini");
export const keyValueAdapter = createIniAdapter("key-value");

export const isIniFormat = (format: ConfigFormat): boolean =>
  format === "ini" || format === "unreal-ini" || format === "key-value";
