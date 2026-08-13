// ../../packages/config-editor/src/manifest.ts
var CONFIG_FORMATS = /* @__PURE__ */ new Set([
  "java-properties",
  "ini",
  "unreal-ini",
  "key-value",
  "json",
  "raw"
]);
var FIELD_TYPES = /* @__PURE__ */ new Set([
  "string",
  "integer",
  "number",
  "boolean",
  "enum",
  "secret"
]);
var DOTTED_VERSION = /^\d+(?:\.\d+)*$/;
var URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
var WINDOWS_DRIVE = /^[a-z]:\//i;
var fail = (message) => {
  throw new TypeError(`Invalid config editor manifest: ${message}`);
};
var objectValue = (value, name) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(`${name} must be an object.`);
  }
  return value;
};
var stringValue = (value, name) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${name} must be a non-empty string.`);
  }
  return value;
};
var optionalString = (value, name) => {
  if (value === void 0) return void 0;
  return stringValue(value, name);
};
var optionalBoolean = (value, name) => {
  if (value === void 0) return void 0;
  if (typeof value !== "boolean") return fail(`${name} must be a boolean.`);
  return value;
};
var optionalNumber = (value, name) => {
  if (value === void 0) return void 0;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(`${name} must be a finite number.`);
  }
  return value;
};
var arrayValue = (value, name) => {
  if (!Array.isArray(value)) return fail(`${name} must be an array.`);
  return value;
};
var assertVersion = (value, name) => {
  if (!DOTTED_VERSION.test(value)) {
    fail(`${name} must be a dotted numeric version.`);
  }
};
var assertSafePath = (path) => {
  const segments = path.split("/");
  const unsafe = path.startsWith("/") || path.includes("\\") || path.includes("\0") || URL_SCHEME.test(path) || WINDOWS_DRIVE.test(path) || segments.some((segment) => segment === "" || segment === "." || segment === "..");
  if (unsafe) fail(`file path "${path}" must be a safe relative path.`);
};
var validateServer = (value) => {
  const server = objectValue(value, "server");
  return {
    family: stringValue(server["family"], "server.family"),
    displayName: stringValue(server["displayName"], "server.displayName"),
    ...server["appVersion"] === void 0 ? {} : { appVersion: stringValue(server["appVersion"], "server.appVersion") }
  };
};
var validateField = (value, location) => {
  const field = objectValue(value, location);
  const type = stringValue(field["type"], `${location}.type`);
  if (!FIELD_TYPES.has(type)) {
    fail(`${location}.type "${type}" is unsupported.`);
  }
  const min = optionalNumber(field["min"], `${location}.min`);
  const max = optionalNumber(field["max"], `${location}.max`);
  if (min !== void 0 && max !== void 0 && min > max) {
    fail(`${location} minimum cannot exceed its maximum.`);
  }
  if ((min !== void 0 || max !== void 0) && type !== "integer" && type !== "number") {
    fail(`${location} numeric ranges require an integer or number field.`);
  }
  let values;
  if (field["values"] !== void 0) {
    values = arrayValue(field["values"], `${location}.values`).map(
      (entry, index) => stringValue(entry, `${location}.values[${index}]`)
    );
    if (new Set(values).size !== values.length) {
      fail(`${location}.values contains duplicate enum values.`);
    }
  }
  if (type === "enum" && (!values || values.length === 0)) {
    fail(`${location} enum values must contain at least one value.`);
  }
  if (type !== "enum" && values !== void 0) {
    fail(`${location}.values is only valid for enum fields.`);
  }
  const pattern = optionalString(field["pattern"], `${location}.pattern`);
  if (pattern !== void 0) {
    try {
      new RegExp(pattern);
    } catch {
      fail(`${location}.pattern must be a valid regular expression.`);
    }
  }
  const since = optionalString(field["since"], `${location}.since`);
  const until = optionalString(field["until"], `${location}.until`);
  if (since !== void 0) assertVersion(since, `${location}.since`);
  if (until !== void 0) assertVersion(until, `${location}.until`);
  if (since !== void 0 && until !== void 0 && compareVersions(since, until) > 0) {
    fail(`${location}.since cannot be later than .until.`);
  }
  const rawDefaultValue = field["defaultValue"];
  if (rawDefaultValue !== void 0 && rawDefaultValue !== null && typeof rawDefaultValue !== "string" && typeof rawDefaultValue !== "number" && typeof rawDefaultValue !== "boolean") {
    fail(`${location}.defaultValue must be a scalar value.`);
  }
  const result = {
    key: stringValue(field["key"], `${location}.key`),
    label: stringValue(field["label"], `${location}.label`),
    description: stringValue(field["description"], `${location}.description`),
    documentation: stringValue(
      field["documentation"],
      `${location}.documentation`
    ),
    type
  };
  if (values !== void 0) result.values = values;
  if (min !== void 0) result.min = min;
  if (max !== void 0) result.max = max;
  if (pattern !== void 0) result.pattern = pattern;
  if (rawDefaultValue !== void 0) {
    result.defaultValue = rawDefaultValue;
  }
  if (field["sensitive"] !== void 0) {
    result.sensitive = optionalBoolean(field["sensitive"], `${location}.sensitive`);
  }
  if (field["restartRequired"] !== void 0) {
    result.restartRequired = optionalBoolean(
      field["restartRequired"],
      `${location}.restartRequired`
    );
  }
  if (since !== void 0) result.since = since;
  if (until !== void 0) result.until = until;
  return result;
};
var validateSection = (value, location) => {
  const section = objectValue(value, location);
  const fields = arrayValue(section["fields"], `${location}.fields`).map(
    (field, index) => validateField(field, `${location}.fields[${index}]`)
  );
  if (fields.length === 0) fail(`${location}.fields must not be empty.`);
  const result = {
    id: stringValue(section["id"], `${location}.id`),
    label: stringValue(section["label"], `${location}.label`),
    fields
  };
  if (section["description"] !== void 0) {
    result.description = stringValue(
      section["description"],
      `${location}.description`
    );
  }
  return result;
};
var validateFile = (value, location) => {
  const file = objectValue(value, location);
  const path = stringValue(file["path"], `${location}.path`);
  assertSafePath(path);
  const format = stringValue(file["format"], `${location}.format`);
  if (!CONFIG_FORMATS.has(format)) {
    fail(`${location}.format "${format}" is unsupported.`);
  }
  const sections = arrayValue(file["sections"], `${location}.sections`).map(
    (section, index) => validateSection(section, `${location}.sections[${index}]`)
  );
  if (sections.length === 0) fail(`${location}.sections must not be empty.`);
  const sectionIds = /* @__PURE__ */ new Set();
  const fieldKeys = /* @__PURE__ */ new Set();
  for (const section of sections) {
    if (sectionIds.has(section.id)) {
      fail(`${location} contains duplicate section id "${section.id}".`);
    }
    sectionIds.add(section.id);
    for (const field of section.fields) {
      if (fieldKeys.has(field.key)) {
        fail(`${location} contains duplicate field key "${field.key}".`);
      }
      fieldKeys.add(field.key);
    }
  }
  const result = {
    path,
    format,
    label: stringValue(file["label"], `${location}.label`),
    sections
  };
  if (file["description"] !== void 0) {
    result.description = stringValue(
      file["description"],
      `${location}.description`
    );
  }
  if (file["documentation"] !== void 0) {
    result.documentation = stringValue(
      file["documentation"],
      `${location}.documentation`
    );
  }
  return result;
};
var validateManifest = (value) => {
  const manifest = objectValue(value, "manifest");
  if (manifest["version"] !== 1) fail("version must be 1.");
  const files = arrayValue(manifest["files"], "files").map(
    (file, index) => validateFile(file, `files[${index}]`)
  );
  if (files.length === 0) fail("files must not be empty.");
  const paths = /* @__PURE__ */ new Set();
  for (const file of files) {
    if (paths.has(file.path)) fail(`files contains duplicate path "${file.path}".`);
    paths.add(file.path);
  }
  return { version: 1, server: validateServer(manifest["server"]), files };
};
var compareVersions = (left, right) => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
};

// ../../packages/config-editor/src/adapters/line-document.ts
var splitSourceLines = (source) => {
  const lines = [];
  let start = 0;
  while (start < source.length) {
    const newline = source.indexOf("\n", start);
    if (newline === -1) {
      lines.push({ raw: source.slice(start), ending: "", start, end: source.length });
      break;
    }
    const hasCarriageReturn = newline > start && source[newline - 1] === "\r";
    const rawEnd = hasCarriageReturn ? newline - 1 : newline;
    lines.push({
      raw: source.slice(start, rawEnd),
      ending: hasCarriageReturn ? "\r\n" : "\n",
      start,
      end: rawEnd
    });
    start = newline + 1;
  }
  return lines;
};
var preferredLineEnding = (lines) => lines.find((line) => line.ending !== "")?.ending || "\n";
var hasFinalNewline = (source) => source.endsWith("\n");

// ../../packages/config-editor/src/adapters/java-properties.ts
var trailingBackslashes = (value) => {
  let count = 0;
  for (let index = value.length - 1; index >= 0 && value[index] === "\\"; index -= 1) {
    count += 1;
  }
  return count;
};
var logicalLineAt = (lines, firstLine) => {
  let text = "";
  const offsets = [];
  let lineIndex = firstLine;
  let continued = false;
  for (; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trim = continued ? line.raw.match(/^[ \t\f]*/)?.[0].length ?? 0 : 0;
    const content = line.raw.slice(trim);
    const continues = trailingBackslashes(content) % 2 === 1;
    const logicalContent = continues ? content.slice(0, -1) : content;
    for (let index = 0; index < logicalContent.length; index += 1) {
      text += logicalContent[index];
      offsets.push(line.start + trim + index);
    }
    continued = continues;
    if (!continues) break;
  }
  const lastLine = Math.min(lineIndex, lines.length - 1);
  return {
    text,
    offsets,
    end: lines[lastLine]?.end ?? 0,
    firstLine,
    lastLine
  };
};
var isEscaped = (value, index) => {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
};
var decodeEscapes = (value) => {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\" || index === value.length - 1) {
      decoded += character;
      continue;
    }
    const escaped = value[index += 1];
    if (escaped === "t") decoded += "	";
    else if (escaped === "n") decoded += "\n";
    else if (escaped === "r") decoded += "\r";
    else if (escaped === "f") decoded += "\f";
    else if (escaped === "u") {
      while (value[index + 1] === "u") index += 1;
      const hexadecimal = value.slice(index + 1, index + 5);
      if (/^[\da-f]{4}$/i.test(hexadecimal)) {
        decoded += String.fromCharCode(Number.parseInt(hexadecimal, 16));
        index += 4;
      } else {
        decoded += "u";
      }
    } else decoded += escaped;
  }
  return decoded;
};
var parseEntry = (logical) => {
  const { text } = logical;
  let start = 0;
  while (start < text.length && /[ \t\f]/.test(text[start])) start += 1;
  if (start === text.length || text[start] === "#" || text[start] === "!") {
    return void 0;
  }
  let keyEnd = start;
  while (keyEnd < text.length) {
    const character = text[keyEnd];
    if (!isEscaped(text, keyEnd) && (character === "=" || character === ":" || /[ \t\f]/.test(character))) {
      break;
    }
    keyEnd += 1;
  }
  let valueStart = keyEnd;
  while (valueStart < text.length && /[ \t\f]/.test(text[valueStart])) {
    valueStart += 1;
  }
  if (valueStart < text.length && (text[valueStart] === "=" || text[valueStart] === ":")) {
    valueStart += 1;
  }
  while (valueStart < text.length && /[ \t\f]/.test(text[valueStart])) {
    valueStart += 1;
  }
  return {
    key: decodeEscapes(text.slice(start, keyEnd)),
    value: decodeEscapes(text.slice(valueStart)),
    valueSpan: {
      start: logical.offsets[valueStart] ?? logical.end,
      end: logical.end
    },
    firstLine: logical.firstLine,
    lastLine: logical.lastLine
  };
};
var classifyNodes = (lines, entries) => {
  const firstLines = new Map(entries.map((entry) => [entry.firstLine, entry]));
  const continuationLines = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    for (let index = entry.firstLine + 1; index <= entry.lastLine; index += 1) {
      continuationLines.add(index);
    }
  }
  return lines.map((line, index) => {
    const entry = firstLines.get(index);
    if (entry) {
      return {
        ...line,
        kind: "entry",
        key: entry.key,
        value: entry.value,
        valueSpan: entry.valueSpan
      };
    }
    if (continuationLines.has(index)) return { ...line, kind: "continuation" };
    const trimmed = line.raw.trimStart();
    if (trimmed === "") return { ...line, kind: "blank" };
    if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
      return { ...line, kind: "comment" };
    }
    return { ...line, kind: "invalid" };
  });
};
var parseJavaProperties = (source) => {
  const lines = splitSourceLines(source);
  const entries = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const logical = logicalLineAt(lines, lineIndex);
    const entry = parseEntry(logical);
    if (entry) entries.push(entry);
    lineIndex = logical.lastLine;
  }
  return {
    format: "java-properties",
    source,
    nodes: classifyNodes(lines, entries),
    entries,
    issues: [],
    lineEnding: preferredLineEnding(lines),
    finalNewline: hasFinalNewline(source)
  };
};
var escapeKey = (value) => value.replace(/[\\ \t\f=:#!]/g, (character) => {
  if (character === "	") return "\\t";
  if (character === "\f") return "\\f";
  return `\\${character}`;
});
var escapeValue = (value) => {
  const text = value === null ? "" : String(value);
  return text.replace(/[\\\t\n\r\f]/g, (character) => {
    if (character === "\\") return "\\\\";
    if (character === "	") return "\\t";
    if (character === "\n") return "\\n";
    if (character === "\r") return "\\r";
    return "\\f";
  }).replace(/^ +/, (spaces) => "\\ ".repeat(spaces.length));
};
var effectiveEntry = (document, key) => {
  for (let index = document.entries.length - 1; index >= 0; index -= 1) {
    const entry = document.entries[index];
    if (entry.key === key) return entry;
  }
  return void 0;
};
var appendEntry = (document, key, value) => {
  const entry = `${escapeKey(key)}=${escapeValue(value)}`;
  if (document.source === "") return entry;
  if (document.finalNewline) return `${document.source}${entry}${document.lineEnding}`;
  return `${document.source}${document.lineEnding}${entry}`;
};
var javaPropertiesAdapter = {
  parse: parseJavaProperties,
  get(document, key) {
    return effectiveEntry(document, key)?.value;
  },
  set(document, key, value) {
    const entry = effectiveEntry(document, key);
    if (!entry) return parseJavaProperties(appendEntry(document, key, value));
    const source = document.source.slice(0, entry.valueSpan.start) + escapeValue(value) + document.source.slice(entry.valueSpan.end);
    return parseJavaProperties(source);
  },
  validate(document, schema) {
    void schema;
    return [...document.issues];
  },
  serialize(document) {
    return document.source;
  }
};

// ../../packages/config-editor/src/adapters/ini.ts
var inlineCommentAt = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    const precededBySpace = index > 0 && /\s/.test(value[index - 1]);
    if (!precededBySpace) continue;
    if (value[index] === ";" || value[index] === "#") return index;
    if (value[index] === "/" && value[index + 1] === "/") return index;
  }
  return value.length;
};
var parseEntryLine = (raw, start, section, line) => {
  let keyStart = 0;
  while (keyStart < raw.length && /[ \t]/.test(raw[keyStart])) keyStart += 1;
  if (keyStart === raw.length) return void 0;
  let keyEnd = keyStart;
  while (keyEnd < raw.length && raw[keyEnd] !== "=" && raw[keyEnd] !== ":" && !/[ \t]/.test(raw[keyEnd])) {
    keyEnd += 1;
  }
  if (keyEnd === keyStart) return void 0;
  let valueStart = keyEnd;
  while (valueStart < raw.length && /[ \t]/.test(raw[valueStart])) valueStart += 1;
  if (raw[valueStart] === "=" || raw[valueStart] === ":") valueStart += 1;
  while (valueStart < raw.length && /[ \t]/.test(raw[valueStart])) valueStart += 1;
  const comment = inlineCommentAt(raw.slice(valueStart));
  let valueEnd = valueStart + comment;
  while (valueEnd > valueStart && /[ \t]/.test(raw[valueEnd - 1])) valueEnd -= 1;
  const localKey = raw.slice(keyStart, keyEnd).trim();
  return {
    key: section ? `${section}.${localKey}` : localKey,
    value: raw.slice(valueStart, valueEnd),
    valueSpan: { start: start + valueStart, end: start + valueEnd },
    line
  };
};
var parseIni = (source, format) => {
  const lines = splitSourceLines(source);
  const entries = [];
  const sections = [];
  const nodes = [];
  let section;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.raw.trimStart();
    if (trimmed === "") {
      nodes.push({ ...line, kind: "blank" });
      continue;
    }
    if (trimmed.startsWith(";") || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      nodes.push({ ...line, kind: "comment" });
      continue;
    }
    const sectionMatch = format === "key-value" ? null : trimmed.match(/^\[([^\]]+)](?:\s*(?:[;#].*)?)$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
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
        valueSpan: entry.valueSpan
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
    finalNewline: hasFinalNewline(source)
  };
};
var effectiveEntry2 = (document, key) => {
  for (let index = document.entries.length - 1; index >= 0; index -= 1) {
    const entry = document.entries[index];
    if (entry.key === key) return entry;
  }
  return void 0;
};
var formatValue = (value) => (value === null ? "" : String(value)).replace(
  /[\r\n]/g,
  (character) => character === "\r" ? "\\r" : "\\n"
);
var appendIniEntry = (document, key, value) => {
  const split = document.format === "key-value" ? -1 : key.lastIndexOf(".");
  const section = split < 0 ? void 0 : key.slice(0, split);
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
var createIniAdapter = (format) => ({
  parse(source) {
    return parseIni(source, format);
  },
  get(document, key) {
    return effectiveEntry2(document, key)?.value;
  },
  set(document, key, value) {
    const entry = effectiveEntry2(document, key);
    if (!entry) return parseIni(appendIniEntry(document, key, value), format);
    return parseIni(
      document.source.slice(0, entry.valueSpan.start) + formatValue(value) + document.source.slice(entry.valueSpan.end),
      format
    );
  },
  validate(document, schema) {
    void schema;
    return [...document.issues];
  },
  serialize(document) {
    return document.source;
  }
});
var iniAdapter = createIniAdapter("ini");
var unrealIniAdapter = createIniAdapter("unreal-ini");
var keyValueAdapter = createIniAdapter("key-value");

// ../../packages/config-editor/src/adapters/json.ts
var JsonParseError = class extends Error {
  position;
  constructor(position, message) {
    super(message);
    this.position = position;
  }
};
var pointerSegment = (value) => value.replace(/~/g, "~0").replace(/\//g, "~1");
var locationAt = (source, position) => {
  const before = source.slice(0, position);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
};
var jsonNodes = (source) => splitSourceLines(source).map((line) => ({
  ...line,
  kind: line.raw.trim() === "" ? "blank" : "invalid"
}));
var parseJson = (source) => {
  const scalars = /* @__PURE__ */ new Map();
  const containers = /* @__PURE__ */ new Set();
  let cursor = 0;
  const fail2 = (message) => {
    throw new JsonParseError(cursor, message);
  };
  const skipWhitespace = () => {
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  };
  const consume = (character) => {
    if (source[cursor] !== character) fail2(`Expected "${character}".`);
    cursor += 1;
  };
  const parseString = () => {
    const start = cursor;
    consume('"');
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === '"') {
        cursor += 1;
        const token = source.slice(start, cursor);
        try {
          return { value: JSON.parse(token), span: { start, end: cursor } };
        } catch {
          fail2("Invalid JSON string.");
        }
      }
      if (character === "\\") {
        cursor += 2;
        continue;
      }
      if (character.charCodeAt(0) < 32) fail2("Unescaped control character.");
      cursor += 1;
    }
    return fail2("Unterminated JSON string.");
  };
  const parseValue = (pointer) => {
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
        if (source[cursor] !== '"') fail2("Expected an object key.");
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
      fail2("Unterminated JSON object.");
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
      fail2("Unterminated JSON array.");
    }
    const remainder = source.slice(cursor);
    const literal = remainder.match(/^(?:true|false|null)(?![\w])/);
    if (literal) {
      cursor += literal[0].length;
      scalars.set(pointer, {
        value: JSON.parse(literal[0]),
        span: { start, end: cursor }
      });
      return;
    }
    const number = remainder.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      cursor += number[0].length;
      scalars.set(pointer, {
        value: Number(number[0]),
        span: { start, end: cursor }
      });
      return;
    }
    fail2("Expected a JSON scalar, object, or array.");
  };
  try {
    parseValue("");
    skipWhitespace();
    if (cursor !== source.length) fail2("Unexpected content after the JSON value.");
    return {
      format: "json",
      source,
      nodes: jsonNodes(source),
      issues: [],
      scalars,
      containers
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
          ...location
        }
      ],
      scalars: /* @__PURE__ */ new Map(),
      containers: /* @__PURE__ */ new Set()
    };
  }
};
var jsonAdapter = {
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
      document.source.slice(0, scalar.span.start) + JSON.stringify(value) + document.source.slice(scalar.span.end)
    );
  },
  validate(document, schema) {
    void schema;
    return [...document.issues];
  },
  serialize(document) {
    return document.source;
  }
};

// ../../packages/config-editor/src/adapters/raw.ts
var parseRaw = (source) => {
  const nodes = splitSourceLines(source).map((line) => ({
    ...line,
    kind: line.raw.trim() === "" ? "blank" : "invalid"
  }));
  return { format: "raw", source, nodes, issues: [] };
};
var rawAdapter = {
  parse: parseRaw,
  get() {
    return void 0;
  },
  set(_document, _key, _value) {
    throw new Error("Raw mode does not support typed field writes.");
  },
  validate(document, schema) {
    void schema;
    return [...document.issues];
  },
  serialize(document) {
    return document.source;
  }
};

// ../../packages/config-editor/src/adapters/registry.ts
var createAdapterRegistry = () => /* @__PURE__ */ new Map([
  ["java-properties", javaPropertiesAdapter],
  ["ini", iniAdapter],
  ["unreal-ini", unrealIniAdapter],
  ["key-value", keyValueAdapter],
  ["json", jsonAdapter],
  ["raw", rawAdapter]
]);

// ../../packages/config-editor/src/validation.ts
var issue = (field, code, message) => ({
  code,
  message,
  severity: "error",
  fieldKey: field.key
});
var scalarText = (input) => {
  if (input === null) return "";
  if (typeof input === "string") return input;
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  throw new TypeError("Value must be a scalar.");
};
var coerceFieldValue = (field, input) => {
  if (field.type === "string" || field.type === "secret" || field.type === "enum") {
    return scalarText(input);
  }
  if (field.type === "boolean") {
    if (input === true || input === false) return input;
    if (input === "true") return true;
    if (input === "false") return false;
    throw new TypeError("Value must be true or false.");
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new TypeError("Value must be a finite number.");
    if (field.type === "integer" && !Number.isSafeInteger(input)) {
      throw new TypeError("Value must be an integer.");
    }
    return input;
  }
  const text = scalarText(input).trim();
  if (field.type === "integer") {
    if (!/^[+-]?\d+$/.test(text)) throw new TypeError("Value must be an integer.");
    const value2 = Number(text);
    if (!Number.isSafeInteger(value2)) throw new TypeError("Value must be an integer.");
    return value2;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    throw new TypeError("Value must be a finite number.");
  }
  const value = Number(text);
  if (!Number.isFinite(value)) throw new TypeError("Value must be a finite number.");
  return value;
};
var validateField2 = (field, value) => {
  const issues = [];
  if (field.type === "integer" && (typeof value !== "number" || !Number.isSafeInteger(value))) {
    issues.push(issue(field, "type", "Value must be an integer."));
    return issues;
  }
  if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    issues.push(issue(field, "type", "Value must be a finite number."));
    return issues;
  }
  if (field.type === "boolean" && typeof value !== "boolean") {
    issues.push(issue(field, "type", "Value must be true or false."));
    return issues;
  }
  if ((field.type === "string" || field.type === "secret" || field.type === "enum") && typeof value !== "string") {
    issues.push(issue(field, "type", "Value must be text."));
    return issues;
  }
  if (typeof value === "number") {
    const below = field.min !== void 0 && value < field.min;
    const above = field.max !== void 0 && value > field.max;
    if (below || above) {
      let message;
      if (field.min !== void 0 && field.max !== void 0) {
        message = `Value must be between ${field.min} and ${field.max} (inclusive).`;
      } else if (field.min !== void 0) message = `Value must be at least ${field.min}.`;
      else message = `Value must be at most ${field.max}.`;
      issues.push(issue(field, "range", message));
    }
  }
  if (field.type === "enum" && typeof value === "string" && !field.values?.includes(value)) {
    issues.push(
      issue(field, "enum", `Value must be one of: ${(field.values ?? []).join(", ")}.`)
    );
  }
  if (field.pattern !== void 0 && typeof value === "string") {
    const pattern = new RegExp(`^(?:${field.pattern})$`);
    if (!pattern.test(value)) {
      issues.push(issue(field, "pattern", "Value does not match the required format."));
    }
  }
  return issues;
};

// ../../packages/config-editor/src/store.ts
var MASKED_SECRET = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
var allFields = (schema) => schema.sections.flatMap((section) => section.fields);
var valuesEqual = (left, right) => Object.is(left, right);
var displayValue = (field, value) => {
  if ((field.sensitive || field.type === "secret") && value !== void 0 && value !== "") {
    return MASKED_SECRET;
  }
  return value === null || value === void 0 ? "" : String(value);
};
var deepFreezeSnapshot = (snapshot) => {
  for (const field of Object.values(snapshot.fields)) {
    for (const fieldIssue of field.issues) Object.freeze(fieldIssue);
    Object.freeze(field.issues);
    Object.freeze(field);
  }
  for (const change of snapshot.changes) Object.freeze(change);
  for (const editorIssue of snapshot.issues) Object.freeze(editorIssue);
  Object.freeze(snapshot.fields);
  Object.freeze(snapshot.changes);
  Object.freeze(snapshot.issues);
  return Object.freeze(snapshot);
};
var ConfigEditorStore = class _ConfigEditorStore {
  schema;
  adapter;
  originalDocument;
  workingDocument;
  fields;
  constructor(schema, document, adapter) {
    this.schema = schema;
    this.adapter = adapter;
    this.originalDocument = document;
    this.workingDocument = document;
    this.fields = this.readFields(document, document);
  }
  static fromLoadedFile(schema, document) {
    if (schema.format !== document.format) {
      throw new TypeError(
        `Schema format "${schema.format}" does not match document format "${document.format}".`
      );
    }
    const adapter = createAdapterRegistry().get(schema.format);
    if (!adapter) throw new TypeError(`No adapter registered for "${schema.format}".`);
    return new _ConfigEditorStore(schema, document, adapter);
  }
  readValue(document, field) {
    const raw = this.adapter.get(document, field.key);
    if (raw === void 0) return { value: void 0, issues: [] };
    try {
      const value = coerceFieldValue(field, raw);
      return { value, issues: validateField2(field, value) };
    } catch (error) {
      return {
        value: void 0,
        issues: [
          {
            code: "type",
            message: error instanceof Error ? error.message : "Invalid value.",
            severity: "error",
            fieldKey: field.key,
            filePath: this.schema.path
          }
        ]
      };
    }
  }
  readFields(original, working) {
    return new Map(
      allFields(this.schema).map((field) => {
        const originalResult = this.readValue(original, field);
        const workingResult = this.readValue(working, field);
        return [
          field.key,
          {
            schema: field,
            original: originalResult.value,
            current: workingResult.value,
            displayValue: displayValue(field, workingResult.value),
            issues: workingResult.issues
          }
        ];
      })
    );
  }
  setDisplayValue(key, input) {
    const state = this.fields.get(key);
    if (!state) throw new TypeError(`Unknown configuration field "${key}".`);
    const sensitive = state.schema.sensitive || state.schema.type === "secret";
    if (sensitive && input === MASKED_SECRET) {
      state.displayValue = MASKED_SECRET;
      state.issues = [];
      return;
    }
    state.displayValue = input;
    let value;
    try {
      value = coerceFieldValue(state.schema, input);
    } catch (error) {
      state.issues = [
        {
          code: "type",
          message: error instanceof Error ? error.message : "Invalid value.",
          severity: "error",
          fieldKey: key,
          filePath: this.schema.path
        }
      ];
      return;
    }
    const issues = validateField2(state.schema, value).map((fieldIssue) => ({
      ...fieldIssue,
      filePath: this.schema.path
    }));
    state.issues = issues;
    if (issues.length > 0) return;
    this.workingDocument = this.adapter.set(this.workingDocument, key, value);
    state.current = value;
    if (sensitive) state.displayValue = MASKED_SECRET;
  }
  serializeSelectedFile() {
    return this.adapter.serialize(this.workingDocument);
  }
  serializeForDisplay() {
    let displayDocument = this.workingDocument;
    for (const field of allFields(this.schema)) {
      if (!(field.sensitive || field.type === "secret")) continue;
      if (this.adapter.get(displayDocument, field.key) === void 0) continue;
      displayDocument = this.adapter.set(displayDocument, field.key, MASKED_SECRET);
    }
    return this.adapter.serialize(displayDocument);
  }
  validateSerializedSource(source) {
    const document = this.adapter.parse(source);
    const issues = this.adapter.validate(document, this.schema);
    for (const field of allFields(this.schema)) {
      issues.push(...this.readValue(document, field).issues);
    }
    return issues;
  }
  loadedSource() {
    return this.adapter.serialize(this.originalDocument);
  }
  replaceWorkingSource(source) {
    let document = this.adapter.parse(source);
    for (const field of allFields(this.schema)) {
      if (!(field.sensitive || field.type === "secret")) continue;
      if (this.adapter.get(document, field.key) !== MASKED_SECRET) continue;
      const currentSecret = this.adapter.get(this.workingDocument, field.key);
      if (currentSecret !== void 0) {
        document = this.adapter.set(document, field.key, currentSecret);
      }
    }
    this.workingDocument = document;
    this.fields = this.readFields(this.originalDocument, this.workingDocument);
  }
  acceptSavedSource(source) {
    const document = this.adapter.parse(source);
    this.originalDocument = document;
    this.workingDocument = document;
    this.fields = this.readFields(document, document);
  }
  snapshot() {
    const fields = {};
    const changes = [];
    const issues = [...this.workingDocument.issues];
    for (const [key, state] of this.fields) {
      const sensitive = Boolean(state.schema.sensitive || state.schema.type === "secret");
      const dirty = !valuesEqual(state.current, state.original);
      const fieldIssues = state.issues.map((fieldIssue) => ({ ...fieldIssue }));
      const fieldSnapshot = {
        key,
        label: state.schema.label,
        type: state.schema.type,
        displayValue: state.displayValue,
        sensitive,
        dirty,
        issues: fieldIssues,
        ...!sensitive && state.current !== void 0 ? { value: state.current } : {}
      };
      fields[key] = fieldSnapshot;
      issues.push(...fieldIssues);
      if (dirty) {
        changes.push({
          key,
          label: state.schema.label,
          before: sensitive ? null : state.original,
          after: sensitive ? null : state.current,
          sensitive,
          restartRequired: Boolean(state.schema.restartRequired)
        });
      }
    }
    return deepFreezeSnapshot({
      filePath: this.schema.path,
      fields,
      changes,
      issues,
      dirty: changes.length > 0,
      restartRequired: changes.some((change) => change.restartRequired)
    });
  }
};

// ../../packages/config-editor/src/fingerprint.ts
var SHA256_CONSTANTS = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
var rotateRight = (value, bits) => value >>> bits | value << 32 - bits;
var utf8Bytes = (source) => {
  const bytes = [];
  for (const character of source) {
    const point = character.codePointAt(0);
    if (point <= 127) bytes.push(point);
    else if (point <= 2047) {
      bytes.push(192 | point >>> 6, 128 | point & 63);
    } else if (point <= 65535) {
      bytes.push(
        224 | point >>> 12,
        128 | point >>> 6 & 63,
        128 | point & 63
      );
    } else {
      bytes.push(
        240 | point >>> 18,
        128 | point >>> 12 & 63,
        128 | point >>> 6 & 63,
        128 | point & 63
      );
    }
  }
  return bytes;
};
var sha256 = (source) => {
  const bytes = utf8Bytes(source);
  const bitLength = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 4294967296);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push(high >>> shift & 255);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push(low >>> shift & 255);
  const hash = [
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ];
  const words = new Array(64).fill(0);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      words[index] = (bytes[cursor] << 24 | bytes[cursor + 1] << 16 | bytes[cursor + 2] << 8 | bytes[cursor + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ previous15 >>> 3;
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ previous2 >>> 10;
      words[index] = words[index - 16] + sigma0 + words[index - 7] + sigma1 >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = e & f ^ ~e & g;
      const temporary1 = h + sum1 + choose + SHA256_CONSTANTS[index] + words[index] >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = a & b ^ a & c ^ b & c;
      const temporary2 = sum0 + majority >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + temporary1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temporary1 + temporary2 >>> 0;
    }
    hash[0] = hash[0] + a >>> 0;
    hash[1] = hash[1] + b >>> 0;
    hash[2] = hash[2] + c >>> 0;
    hash[3] = hash[3] + d >>> 0;
    hash[4] = hash[4] + e >>> 0;
    hash[5] = hash[5] + f >>> 0;
    hash[6] = hash[6] + g >>> 0;
    hash[7] = hash[7] + h >>> 0;
  }
  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
};
var fingerprint = async (source) => sha256(source);

// ../../packages/config-editor/src/gateway.ts
var schemaForPath = (manifest, path) => {
  const schema = path ? manifest.files.find((candidate) => candidate.path === path) : manifest.files[0];
  if (!schema) throw new TypeError(path ? `Manifest has no file "${path}".` : "Manifest has no files.");
  return schema;
};
var loadEditor = async (gateway2, manifest, path) => {
  const schema = schemaForPath(manifest, path);
  const adapter = createAdapterRegistry().get(schema.format);
  if (!adapter) throw new TypeError(`No adapter registered for "${schema.format}".`);
  const source = await gateway2.load(schema.path);
  return ConfigEditorStore.fromLoadedFile(schema, adapter.parse(source));
};
var saveSelectedFile = async (store, gateway2) => {
  if (store.snapshot().issues.some((issue2) => issue2.severity === "error")) {
    throw new Error("Configuration has validation errors and cannot be saved.");
  }
  const content = store.serializeSelectedFile();
  const serializedIssues = store.validateSerializedSource(content);
  if (serializedIssues.some((issue2) => issue2.severity === "error")) {
    throw new Error("Serialized configuration failed validation.");
  }
  const expectedFingerprint = await fingerprint(store.loadedSource());
  const result = await gateway2.save(store.schema.path, content, expectedFingerprint);
  if (result.status === "conflict") return result;
  const contentFingerprint = await fingerprint(content);
  if (result.fingerprint !== contentFingerprint) {
    throw new Error("Save verification failed: gateway fingerprint does not match content.");
  }
  const remote = await gateway2.load(store.schema.path);
  const remoteFingerprint = await fingerprint(remote);
  if (remoteFingerprint !== result.fingerprint || remote !== content) {
    throw new Error("Save verification failed: reloaded content differs from the saved content.");
  }
  store.acceptSavedSource(remote);
  return result;
};

// ../../packages/component/dist/index.js
import { d as dfunc } from "druid:ui/ui";
import { log, rerender, setHook } from "druid:ui/ui";
import { Event } from "druid:ui/utils";
import { log as log2, rerender as rerender2 } from "druid:ui/ui";
var lowerPropertyValue = (value) => value === void 0 || value === null ? void 0 : String(value);
var callbackMap = {};
function emit(nodeid, event, e) {
  log(`Emit called for nodeid: ${nodeid}, event: ${event}`);
  const callbacks = callbackMap[nodeid];
  const result = callbacks?.[event]?.(e);
  if (result instanceof Promise) {
    result.then(() => rerender());
  }
}
var registerHooks = (id, fnresult) => {
  switch (true) {
    case !!fnresult.init:
      setHook(id, "init");
      callbackMap[id] = {
        ...callbackMap[id],
        init: fnresult.init
      };
      break;
  }
};
var createDFunc = (dfunc2) => {
  return (tag, props, ...children) => {
    children = children.flat();
    if (typeof tag !== "string") {
      if (typeof tag === "function") {
        const fnresult = tag(props);
        if (fnresult?.view) {
          const id3 = fnresult.view(props);
          registerHooks(id3, fnresult);
          return id3;
        } else {
          return tag(props);
        }
      }
      const id2 = tag.view(props);
      registerHooks(id2, tag);
      return id2;
    }
    const ps = { prop: [], on: [] };
    const cbObj = {};
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value instanceof Function) {
          const eventKey = key.startsWith("on") ? key.slice(2).toLowerCase() : key;
          cbObj[eventKey] = value;
          ps.on.push(eventKey);
        } else {
          const loweredValue = lowerPropertyValue(value);
          if (loweredValue === void 0) continue;
          if (typeof value === "boolean") {
            ps.prop.push({ key, value: loweredValue });
            continue;
          }
          ps.prop.push({ key, value: loweredValue });
        }
      }
    }
    const id = dfunc2(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => String(c))
    );
    callbackMap[id] = {
      ...callbackMap[id],
      ...cbObj
    };
    return id;
  };
};
var pendingOperations = /* @__PURE__ */ new Map();
var asyncCallback = (id, result) => {
  log(`Async callback received for id: ${id} with result: ${result.tag}`);
  const pending = pendingOperations.get(id);
  if (pending) {
    if (result.tag === "ok") {
      pending.resolve(result.val);
    } else {
      pending.reject(new Error(result.val));
    }
    pendingOperations.delete(id);
    rerender();
  }
};
var rawAsyncToPromise = (fn) => (...args) => {
  return new Promise((resolve, reject) => {
    const asyncId = fn(...args);
    pendingOperations.set(asyncId, { resolve, reject });
  });
};
var createComponent = (j) => ({
  init: (ctx) => j(ctx),
  emit,
  asyncComplete: asyncCallback
});
var d2 = createDFunc(dfunc);

// ../../packages/config-editor/src/copy.ts
var copy = {
  appTitle: "Server configuration",
  loading: "Loading configuration\u2026",
  formTab: "Form",
  rawTab: "Raw",
  filesHeading: "Configuration files",
  inspectorHeading: "Changes & validation",
  noChanges: "No pending changes",
  unknownKeys: "Unknown keys: Preserved",
  restartRequired: "Restart required",
  noRestartRequired: "No restart required",
  save: "Save changes",
  saving: "Saving\u2026",
  saved: "Saved and verified",
  conflict: "Remote file changed. Reload before saving.",
  rawLabel: "Raw configuration",
  validationHeading: "Validation",
  valid: "Configuration is valid",
  secretChanged: "Secret changed",
  fileFormat: "Format"
};

// ../../packages/config-editor/src/styles.ts
var EDITOR_STYLES = `
:host {
  display: block;
  width: 100%;
  --druid-bg: #07100d;
  --druid-panel: #101b17;
  --druid-panel-raised: #15231d;
  --druid-border: #294137;
  --druid-border-strong: #3f6655;
  --druid-text: #f4f7f5;
  --druid-muted: #9eb0a8;
  --druid-accent: #a8ef9c;
  --druid-accent-ink: #10210f;
  --druid-warning: #f0c96b;
  --druid-error: #ff8b7f;
  color: var(--druid-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
button, input, select, textarea { font: inherit; }
button, input, select, textarea, a { outline: none; }
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible {
  box-shadow: 0 0 0 3px rgba(168, 239, 156, .28);
  border-color: var(--druid-accent);
}
.config-editor { min-height: 640px; background: radial-gradient(circle at 75% 0%, #173326 0, transparent 32%), var(--druid-bg); color: var(--druid-text); }
.editor-header { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 22px; border-bottom: 1px solid var(--druid-border); }
.eyebrow { color: var(--druid-accent); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.editor-title { margin: 3px 0 0; font-size: clamp(20px, 2.4vw, 30px); line-height: 1.1; }
.server-version { color: var(--druid-muted); font-size: 13px; }
.editor-grid { display: grid; grid-template-columns: minmax(210px, 250px) minmax(420px, 1fr) minmax(260px, 320px); min-height: 564px; }
.file-rail, .inspector { background: rgba(11, 21, 17, .8); }
.file-rail { padding: 18px 14px; border-right: 1px solid var(--druid-border); }
.rail-heading, .inspector h2 { margin: 0 0 12px; font-size: 12px; color: var(--druid-muted); letter-spacing: .08em; text-transform: uppercase; }
.file-list { display: grid; gap: 8px; }
.file-button { width: 100%; min-height: 52px; display: grid; gap: 3px; padding: 10px 12px; text-align: left; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--druid-text); cursor: pointer; }
.file-button:hover { background: var(--druid-panel); }
.file-button[aria-current="true"] { border-color: var(--druid-border-strong); background: var(--druid-panel-raised); }
.file-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.file-format { color: var(--druid-muted); font-size: 12px; text-transform: uppercase; }
.editor-main { min-width: 0; padding: 18px 22px 92px; }
.tabs { display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 18px; border: 1px solid var(--druid-border); border-radius: 10px; background: #0b1511; }
.tab { min-height: 40px; min-width: 92px; border: 0; border-radius: 7px; background: transparent; color: var(--druid-muted); cursor: pointer; }
.tab[aria-selected="true"] { background: var(--druid-panel-raised); color: var(--druid-text); }
.form-editor { display: grid; gap: 18px; }
.field-section { min-width: 0; margin: 0; padding: 18px; border: 1px solid var(--druid-border); border-radius: 14px; background: rgba(16, 27, 23, .84); }
.field-section legend { padding: 0 8px; color: var(--druid-accent); font-weight: 800; }
.section-description { margin: 0 0 16px; color: var(--druid-muted); font-size: 13px; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.field-control { min-width: 0; display: grid; align-content: start; gap: 7px; }
.field-control label { font-size: 13px; font-weight: 750; }
.field-description { min-height: 34px; margin: 0; color: var(--druid-muted); font-size: 12px; line-height: 1.45; }
.field-input { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--druid-border); border-radius: 9px; background: #09130f; color: var(--druid-text); }
.boolean-control { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 8px 11px; border: 1px solid var(--druid-border); border-radius: 9px; background: #09130f; }
.boolean-control input { width: 20px; height: 20px; accent-color: var(--druid-accent); }
.field-meta { display: flex; flex-wrap: wrap; gap: 8px; color: var(--druid-muted); font-size: 11px; }
.restart-chip { color: var(--druid-warning); }
.field-error { margin: 0; color: var(--druid-error); font-size: 12px; }
.raw-editor { display: grid; gap: 10px; }
.raw-textarea { width: 100%; min-height: 440px; resize: vertical; padding: 16px; border: 1px solid var(--druid-border); border-radius: 12px; background: #050b08; color: #dce8e1; font: 13px/1.55 "Cascadia Code", "SFMono-Regular", Consolas, monospace; tab-size: 2; }
.inspector { display: flex; flex-direction: column; gap: 18px; padding: 18px; border-left: 1px solid var(--druid-border); }
.status-card { padding: 14px; border: 1px solid var(--druid-border); border-radius: 12px; background: var(--druid-panel); }
.status-card p { margin: 4px 0; color: var(--druid-muted); font-size: 13px; }
.change-list, .issue-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.change-item { padding: 10px; border: 1px solid var(--druid-border); border-radius: 9px; background: #0b1511; font-size: 13px; }
.change-value { display: block; margin-top: 4px; color: var(--druid-muted); word-break: break-word; }
.issue-item { color: var(--druid-error); font-size: 12px; }
.action-bar { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: auto 0 0; padding-top: 14px; background: linear-gradient(transparent, rgba(11, 21, 17, .98) 32%); }
.save-button { min-height: 46px; padding: 0 18px; border: 0; border-radius: 9px; background: var(--druid-accent); color: var(--druid-accent-ink); font-weight: 850; cursor: pointer; }
.save-button:disabled { opacity: .45; cursor: not-allowed; }
.action-status { color: var(--druid-muted); font-size: 12px; }
.error-shell { margin: 20px; padding: 18px; border: 1px solid var(--druid-error); border-radius: 12px; background: #28120f; color: #ffd8d2; }
@media (max-width: 900px) {
  .editor-grid { grid-template-columns: 190px minmax(0, 1fr); }
  .inspector { grid-column: 1 / -1; border-left: 0; border-top: 1px solid var(--druid-border); }
}
@media (max-width: 560px) {
  .config-editor { min-height: 100%; }
  .editor-header { align-items: flex-start; padding: 14px 16px; }
  .editor-grid { display: block; }
  .file-rail { padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--druid-border); overflow-x: auto; }
  .file-list { display: flex; width: max-content; }
  .file-button { width: 190px; }
  .editor-main { padding: 16px 16px 28px; }
  .tabs { display: flex; }
  .tab { flex: 1; }
  .field-section { padding: 14px; }
  .field-grid { grid-template-columns: 1fr; }
  .raw-textarea { min-height: 360px; }
  .inspector { padding: 16px; }
  .action-bar { position: static; }
  .save-button { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; }
}
`;

// ../../packages/component/dist/jsx-runtime.js
function jsx(type, props) {
  const { children, ...rest } = props || {};
  if (children !== void 0) {
    return d2(type, rest, children);
  }
  return d2(type, rest);
}
var jsxs = jsx;
var Fragment = Symbol.for("react.fragment");

// ../../packages/config-editor/src/components/ActionBar.tsx
var ActionBar = ({ dirty, invalid, saving, status, onSave }) => /* @__PURE__ */ jsxs("div", { class: "action-bar", children: [
  /* @__PURE__ */ jsx("span", { class: "action-status", "aria-live": "polite", children: status }),
  /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      class: "save-button",
      disabled: !dirty || invalid || saving,
      onClick: () => onSave(),
      children: saving ? copy.saving : copy.save
    }
  )
] });

// ../../packages/config-editor/src/components/FileRail.tsx
var FileRail = ({ manifest, selectedPath, onSelect }) => /* @__PURE__ */ jsxs("nav", { class: "file-rail", "aria-label": copy.filesHeading, children: [
  /* @__PURE__ */ jsx("h2", { class: "rail-heading", children: copy.filesHeading }),
  /* @__PURE__ */ jsx("div", { class: "file-list", children: manifest.files.map((file) => /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      class: "file-button",
      "aria-current": file.path === selectedPath ? "true" : "false",
      onClick: () => onSelect(file.path),
      children: [
        /* @__PURE__ */ jsx("span", { class: "file-path", children: file.label }),
        /* @__PURE__ */ jsx("span", { class: "file-format", children: file.format })
      ]
    }
  )) })
] });

// ../../packages/config-editor/src/components/FieldControl.tsx
var FieldControl = ({ field, state, onChange }) => {
  const inputId = `config-field-${field.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const descriptionId = `${inputId}-description`;
  const input = field.type === "enum" ? /* @__PURE__ */ jsx(
    "select",
    {
      id: inputId,
      class: "field-input",
      "aria-label": field.label,
      "aria-describedby": descriptionId,
      "aria-invalid": state.issues.length > 0 ? "true" : "false",
      value: state.displayValue,
      onChange: (event) => onChange(field.key, event.value()),
      children: (field.values ?? []).map((value) => /* @__PURE__ */ jsx("option", { value, selected: state.displayValue === value, children: value }))
    }
  ) : field.type === "boolean" ? /* @__PURE__ */ jsxs("span", { class: "boolean-control", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        id: inputId,
        type: "checkbox",
        "aria-label": field.label,
        "aria-describedby": descriptionId,
        checked: state.displayValue === "true",
        onChange: (event) => onChange(field.key, event.checked() ? "true" : "false")
      }
    ),
    /* @__PURE__ */ jsx("span", { children: state.displayValue === "true" ? "Enabled" : "Disabled" })
  ] }) : /* @__PURE__ */ jsx(
    "input",
    {
      id: inputId,
      class: "field-input",
      "aria-label": field.label,
      "aria-describedby": descriptionId,
      type: field.type === "secret" || field.sensitive ? "password" : field.type === "integer" || field.type === "number" ? "number" : "text",
      step: field.type === "integer" ? "1" : field.type === "number" ? "any" : void 0,
      min: field.min,
      max: field.max,
      value: state.displayValue,
      "aria-invalid": state.issues.length > 0 ? "true" : "false",
      autocomplete: field.type === "secret" || field.sensitive ? "new-password" : "off",
      onInput: (event) => onChange(field.key, event.value())
    }
  );
  return /* @__PURE__ */ jsxs("div", { class: "field-control", children: [
    /* @__PURE__ */ jsx("label", { for: inputId, children: field.label }),
    /* @__PURE__ */ jsx("p", { id: descriptionId, class: "field-description", children: field.description }),
    input,
    /* @__PURE__ */ jsxs("div", { class: "field-meta", children: [
      field.restartRequired ? /* @__PURE__ */ jsx("span", { class: "restart-chip", children: copy.restartRequired }) : false,
      /* @__PURE__ */ jsx("span", { children: field.key })
    ] }),
    state.issues.map((issue2) => /* @__PURE__ */ jsx("p", { class: "field-error", role: "alert", children: issue2.message }))
  ] });
};

// ../../packages/config-editor/src/components/FormEditor.tsx
var FormEditor = ({ schema, snapshot, onChange }) => /* @__PURE__ */ jsx("div", { class: "form-editor", children: schema.sections.map((section) => /* @__PURE__ */ jsxs("fieldset", { class: "field-section", children: [
  /* @__PURE__ */ jsx("legend", { children: section.label }),
  section.description ? /* @__PURE__ */ jsx("p", { class: "section-description", children: section.description }) : false,
  /* @__PURE__ */ jsx("div", { class: "field-grid", children: section.fields.map((field) => {
    const state = snapshot.fields[field.key];
    return state ? /* @__PURE__ */ jsx(FieldControl, { field, state, onChange }) : false;
  }) })
] })) });

// ../../packages/config-editor/src/components/Inspector.tsx
var printable = (value) => value === void 0 ? "Not set" : value === null ? "Protected" : String(value);
var Inspector = ({ snapshot }) => /* @__PURE__ */ jsxs("aside", { class: "inspector", "aria-label": copy.inspectorHeading, children: [
  /* @__PURE__ */ jsxs("section", { children: [
    /* @__PURE__ */ jsx("h2", { children: copy.inspectorHeading }),
    snapshot.changes.length === 0 ? /* @__PURE__ */ jsx("div", { class: "status-card", children: /* @__PURE__ */ jsx("p", { children: copy.noChanges }) }) : /* @__PURE__ */ jsx("ul", { class: "change-list", children: snapshot.changes.map((change) => /* @__PURE__ */ jsxs("li", { class: "change-item", children: [
      /* @__PURE__ */ jsx("strong", { children: change.label }),
      /* @__PURE__ */ jsx("span", { class: "change-value", children: change.sensitive ? copy.secretChanged : `${printable(change.before)} \u2192 ${printable(change.after)}` })
    ] })) })
  ] }),
  /* @__PURE__ */ jsxs("section", { class: "status-card", children: [
    /* @__PURE__ */ jsx("h2", { children: copy.validationHeading }),
    snapshot.issues.length === 0 ? /* @__PURE__ */ jsx("p", { children: copy.valid }) : /* @__PURE__ */ jsx("ul", { class: "issue-list", "aria-live": "polite", children: snapshot.issues.map((issue2) => /* @__PURE__ */ jsx("li", { class: "issue-item", children: issue2.message })) }),
    /* @__PURE__ */ jsx("p", { children: copy.unknownKeys }),
    /* @__PURE__ */ jsx("p", { children: snapshot.restartRequired ? copy.restartRequired : copy.noRestartRequired })
  ] })
] });

// ../../packages/config-editor/src/components/RawEditor.tsx
var RawEditor = ({ source, onChange }) => /* @__PURE__ */ jsxs("div", { class: "raw-editor", children: [
  /* @__PURE__ */ jsx("label", { for: "config-raw-source", children: copy.rawLabel }),
  /* @__PURE__ */ jsx(
    "textarea",
    {
      id: "config-raw-source",
      class: "raw-textarea",
      "aria-label": copy.rawLabel,
      spellcheck: "false",
      value: source,
      onInput: (event) => onChange(event.value())
    }
  )
] });

// ../../packages/config-editor/src/components/EditorApp.tsx
var EditorApp = ({
  manifest,
  store,
  snapshot,
  mode,
  saving,
  status,
  onMode,
  onSelect,
  onField,
  onRaw,
  onSave
}) => /* @__PURE__ */ jsxs("div", { class: "config-editor", children: [
  /* @__PURE__ */ jsx("style", { children: EDITOR_STYLES }),
  /* @__PURE__ */ jsxs("header", { class: "editor-header", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { class: "eyebrow", children: "Druid Admin UI" }),
      /* @__PURE__ */ jsx("h1", { class: "editor-title", children: manifest.server.displayName })
    ] }),
    /* @__PURE__ */ jsx("div", { class: "server-version", children: manifest.server.appVersion ? `Version ${manifest.server.appVersion}` : copy.appTitle })
  ] }),
  /* @__PURE__ */ jsxs("div", { class: "editor-grid", children: [
    /* @__PURE__ */ jsx(
      FileRail,
      {
        manifest,
        selectedPath: store.schema.path,
        onSelect
      }
    ),
    /* @__PURE__ */ jsxs("main", { class: "editor-main", children: [
      /* @__PURE__ */ jsxs("div", { class: "tabs", role: "tablist", "aria-label": "Editor mode", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            class: "tab",
            role: "tab",
            "aria-selected": mode === "form" ? "true" : "false",
            onClick: () => onMode("form"),
            children: copy.formTab
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            class: "tab",
            role: "tab",
            "aria-selected": mode === "raw" ? "true" : "false",
            onClick: () => onMode("raw"),
            children: copy.rawTab
          }
        )
      ] }),
      mode === "form" ? /* @__PURE__ */ jsx(FormEditor, { schema: store.schema, snapshot, onChange: onField }) : /* @__PURE__ */ jsx(RawEditor, { source: store.serializeForDisplay(), onChange: onRaw }),
      /* @__PURE__ */ jsx(
        ActionBar,
        {
          dirty: snapshot.dirty,
          invalid: snapshot.issues.some((issue2) => issue2.severity === "error"),
          saving,
          status,
          onSave
        }
      )
    ] }),
    /* @__PURE__ */ jsx(Inspector, { snapshot })
  ] })
] });
var createConfigEditorComponent = ({
  manifestPath,
  gateway: gateway2
}) => {
  let manifest;
  const stores = /* @__PURE__ */ new Map();
  let selectedPath = "";
  let mode = "form";
  let loading = false;
  let saving = false;
  let status = "";
  let errorMessage = "";
  const selectFile = async (path) => {
    if (!manifest) return;
    selectedPath = path;
    status = copy.loading;
    let store = stores.get(path);
    if (!store) {
      store = await loadEditor(gateway2, manifest, path);
      stores.set(path, store);
    }
    status = "";
    rerender2();
  };
  const initialise = async () => {
    loading = true;
    try {
      manifest = validateManifest(JSON.parse(await gateway2.load(manifestPath)));
      selectedPath = manifest.files[0].path;
      await selectFile(selectedPath);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
      rerender2();
    }
  };
  const save = async () => {
    const store = stores.get(selectedPath);
    if (!store) return;
    saving = true;
    status = copy.saving;
    try {
      const result = await saveSelectedFile(store, gateway2);
      status = result.status === "saved" ? copy.saved : copy.conflict;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
      rerender2();
    }
  };
  return createComponent(() => {
    if (!loading && !manifest && !errorMessage) void initialise();
    if (errorMessage) {
      return /* @__PURE__ */ jsxs("div", { class: "config-editor", children: [
        /* @__PURE__ */ jsx("style", { children: EDITOR_STYLES }),
        /* @__PURE__ */ jsx("div", { class: "error-shell", role: "alert", children: errorMessage })
      ] });
    }
    const store = stores.get(selectedPath);
    if (!manifest || !store) {
      return /* @__PURE__ */ jsxs("div", { class: "config-editor", children: [
        /* @__PURE__ */ jsx("style", { children: EDITOR_STYLES }),
        /* @__PURE__ */ jsx("div", { class: "status-card", "aria-live": "polite", children: copy.loading })
      ] });
    }
    const snapshot = store.snapshot();
    return /* @__PURE__ */ jsx(
      EditorApp,
      {
        manifest,
        store,
        snapshot,
        mode,
        saving,
        status,
        onMode: (nextMode) => {
          mode = nextMode;
        },
        onSelect: selectFile,
        onField: (key, value) => {
          store.setDisplayValue(key, value);
          status = "";
        },
        onRaw: (source) => {
          store.replaceWorkingSource(source);
          status = "";
        },
        onSave: save
      }
    );
  });
};

// ../../packages/plattform/dist/index.js
import {
  request as requestRaw,
  loadFileFromDeployment as loadFileFromDeploymentRaw,
  saveFileToDeployment as saveFileToDeploymentRaw
} from "druid:ui/plattform";
var request = rawAsyncToPromise(requestRaw);
var loadFileFromDeployment = rawAsyncToPromise(
  loadFileFromDeploymentRaw
);
var saveFileToDeployment = rawAsyncToPromise(saveFileToDeploymentRaw);

// src/app.tsx
var gateway = {
  async load(path) {
    return await loadFileFromDeployment(path);
  },
  async save(path, content, expectedFingerprint) {
    const remote = await loadFileFromDeployment(path);
    const remoteFingerprint = await fingerprint(remote);
    if (remoteFingerprint !== expectedFingerprint) {
      return { status: "conflict", remote, fingerprint: remoteFingerprint };
    }
    await saveFileToDeployment(path, content);
    return { status: "saved", fingerprint: await fingerprint(content) };
  }
};
var component = createConfigEditorComponent({
  manifestPath: "private/config-editor.manifest.json",
  gateway
});
export {
  component
};
