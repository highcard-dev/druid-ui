import { createAdapterRegistry } from "./adapters/registry.js";
import type { ConfigAdapter, ParsedDocument } from "./adapters/types.js";
import type {
  ConfigValue,
  FieldSchema,
  FileSchema,
  FieldType,
  ValidationIssue,
} from "./model.js";
import { coerceFieldValue, validateField } from "./validation.js";

export const MASKED_SECRET = "••••••••";

interface InternalFieldState {
  schema: FieldSchema;
  original: ConfigValue | undefined;
  current: ConfigValue | undefined;
  displayValue: string;
  issues: ValidationIssue[];
}

export interface FieldSnapshot {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly displayValue: string;
  readonly sensitive: boolean;
  readonly dirty: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly value?: ConfigValue;
}

export interface ChangeRecord {
  readonly key: string;
  readonly label: string;
  readonly before: ConfigValue | null | undefined;
  readonly after: ConfigValue | null | undefined;
  readonly sensitive: boolean;
  readonly restartRequired: boolean;
}

export interface EditorSnapshot {
  readonly filePath: string;
  readonly fields: Readonly<Record<string, FieldSnapshot>>;
  readonly changes: readonly ChangeRecord[];
  readonly issues: readonly ValidationIssue[];
  readonly dirty: boolean;
  readonly restartRequired: boolean;
}

const allFields = (schema: FileSchema): FieldSchema[] =>
  schema.sections.flatMap((section) => section.fields);

const valuesEqual = (
  left: ConfigValue | undefined,
  right: ConfigValue | undefined,
): boolean => Object.is(left, right);

const displayValue = (
  field: FieldSchema,
  value: ConfigValue | undefined,
): string => {
  if ((field.sensitive || field.type === "secret") && value !== undefined && value !== "") {
    return MASKED_SECRET;
  }
  return value === null || value === undefined ? "" : String(value);
};

const deepFreezeSnapshot = (snapshot: EditorSnapshot): EditorSnapshot => {
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

export class ConfigEditorStore {
  readonly schema: FileSchema;
  private readonly adapter: ConfigAdapter;
  private originalDocument: ParsedDocument;
  private workingDocument: ParsedDocument;
  private fields: Map<string, InternalFieldState>;

  private constructor(
    schema: FileSchema,
    document: ParsedDocument,
    adapter: ConfigAdapter,
  ) {
    this.schema = schema;
    this.adapter = adapter;
    this.originalDocument = document;
    this.workingDocument = document;
    this.fields = this.readFields(document, document);
  }

  static fromLoadedFile(
    schema: FileSchema,
    document: ParsedDocument,
  ): ConfigEditorStore {
    if (schema.format !== document.format) {
      throw new TypeError(
        `Schema format "${schema.format}" does not match document format "${document.format}".`,
      );
    }
    const adapter = createAdapterRegistry().get(schema.format);
    if (!adapter) throw new TypeError(`No adapter registered for "${schema.format}".`);
    return new ConfigEditorStore(schema, document, adapter);
  }

  private readValue(
    document: ParsedDocument,
    field: FieldSchema,
  ): { value: ConfigValue | undefined; issues: ValidationIssue[] } {
    const raw = this.adapter.get(document, field.key);
    if (raw === undefined) return { value: undefined, issues: [] };
    try {
      const value = coerceFieldValue(field, raw);
      return { value, issues: validateField(field, value) };
    } catch (error) {
      return {
        value: undefined,
        issues: [
          {
            code: "type",
            message: error instanceof Error ? error.message : "Invalid value.",
            severity: "error",
            fieldKey: field.key,
            filePath: this.schema.path,
          },
        ],
      };
    }
  }

  private readFields(
    original: ParsedDocument,
    working: ParsedDocument,
  ): Map<string, InternalFieldState> {
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
            issues: workingResult.issues,
          },
        ];
      }),
    );
  }

  setDisplayValue(key: string, input: string): void {
    const state = this.fields.get(key);
    if (!state) throw new TypeError(`Unknown configuration field "${key}".`);
    const sensitive = state.schema.sensitive || state.schema.type === "secret";
    if (sensitive && input === MASKED_SECRET) {
      state.displayValue = MASKED_SECRET;
      state.issues = [];
      return;
    }

    state.displayValue = input;
    let value: ConfigValue;
    try {
      value = coerceFieldValue(state.schema, input);
    } catch (error) {
      state.issues = [
        {
          code: "type",
          message: error instanceof Error ? error.message : "Invalid value.",
          severity: "error",
          fieldKey: key,
          filePath: this.schema.path,
        },
      ];
      return;
    }

    const issues = validateField(state.schema, value).map((fieldIssue) => ({
      ...fieldIssue,
      filePath: this.schema.path,
    }));
    state.issues = issues;
    if (issues.length > 0) return;
    this.workingDocument = this.adapter.set(this.workingDocument, key, value);
    state.current = value;
    if (sensitive) state.displayValue = MASKED_SECRET;
  }

  serializeSelectedFile(): string {
    return this.adapter.serialize(this.workingDocument);
  }

  serializeForDisplay(): string {
    let displayDocument = this.workingDocument;
    for (const field of allFields(this.schema)) {
      if (!(field.sensitive || field.type === "secret")) continue;
      if (this.adapter.get(displayDocument, field.key) === undefined) continue;
      displayDocument = this.adapter.set(displayDocument, field.key, MASKED_SECRET);
    }
    return this.adapter.serialize(displayDocument);
  }

  validateSerializedSource(source: string): ValidationIssue[] {
    const document = this.adapter.parse(source);
    const issues = this.adapter.validate(document, this.schema);
    for (const field of allFields(this.schema)) {
      issues.push(...this.readValue(document, field).issues);
    }
    return issues;
  }

  loadedSource(): string {
    return this.adapter.serialize(this.originalDocument);
  }

  replaceWorkingSource(source: string): void {
    let document = this.adapter.parse(source);
    for (const field of allFields(this.schema)) {
      if (!(field.sensitive || field.type === "secret")) continue;
      if (this.adapter.get(document, field.key) !== MASKED_SECRET) continue;
      const currentSecret = this.adapter.get(this.workingDocument, field.key);
      if (currentSecret !== undefined) {
        document = this.adapter.set(document, field.key, currentSecret);
      }
    }
    this.workingDocument = document;
    this.fields = this.readFields(this.originalDocument, this.workingDocument);
  }

  acceptSavedSource(source: string): void {
    const document = this.adapter.parse(source);
    this.originalDocument = document;
    this.workingDocument = document;
    this.fields = this.readFields(document, document);
  }

  snapshot(): EditorSnapshot {
    const fields: Record<string, FieldSnapshot> = {};
    const changes: ChangeRecord[] = [];
    const issues: ValidationIssue[] = [...this.workingDocument.issues];

    for (const [key, state] of this.fields) {
      const sensitive = Boolean(state.schema.sensitive || state.schema.type === "secret");
      const dirty = !valuesEqual(state.current, state.original);
      const fieldIssues = state.issues.map((fieldIssue) => ({ ...fieldIssue }));
      const fieldSnapshot: FieldSnapshot = {
        key,
        label: state.schema.label,
        type: state.schema.type,
        displayValue: state.displayValue,
        sensitive,
        dirty,
        issues: fieldIssues,
        ...(!sensitive && state.current !== undefined
          ? { value: state.current }
          : {}),
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
          restartRequired: Boolean(state.schema.restartRequired),
        });
      }
    }

    return deepFreezeSnapshot({
      filePath: this.schema.path,
      fields,
      changes,
      issues,
      dirty: changes.length > 0,
      restartRequired: changes.some((change) => change.restartRequired),
    });
  }
}
