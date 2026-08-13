import { describe, expect, it } from "vitest";
import { javaPropertiesAdapter } from "./adapters/java-properties.js";
import type { FieldSchema, FileSchema } from "./model.js";
import { ConfigEditorStore, MASKED_SECRET } from "./store.js";

const baseField = (overrides: Partial<FieldSchema> = {}): FieldSchema => ({
  key: "max-players",
  label: "Max players",
  description: "Maximum player count.",
  documentation: "https://minecraft.wiki/w/Server.properties",
  type: "integer",
  min: 1,
  max: 1000,
  ...overrides,
});

const fileSchema = (fields: FieldSchema[]): FileSchema => ({
  path: "server.properties",
  format: "java-properties",
  label: "server.properties",
  sections: [{ id: "general", label: "General", fields }],
});

const loadedStore = (source: string, schema: FileSchema): ConfigEditorStore =>
  ConfigEditorStore.fromLoadedFile(schema, javaPropertiesAdapter.parse(source));

describe("ConfigEditorStore", () => {
  it("does not serialize an unchanged masked secret", () => {
    const store = loadedStore(
      "rcon.password=actual-secret\n",
      fileSchema([
        baseField({
          key: "rcon.password",
          label: "RCON password",
          type: "secret",
          min: undefined,
          max: undefined,
          sensitive: true,
        }),
      ]),
    );
    expect(store.snapshot().fields["rcon.password"]!.displayValue).toBe(
      MASKED_SECRET,
    );
    store.setDisplayValue("rcon.password", MASKED_SECRET);
    expect(store.serializeSelectedFile()).toBe(
      "rcon.password=actual-secret\n",
    );
  });

  it("tracks changes and restart impact by stable key", () => {
    const store = loadedStore(
      "view-distance=10\n",
      fileSchema([
        baseField({
          key: "view-distance",
          label: "View distance",
          min: 1,
          max: 32,
          restartRequired: true,
        }),
      ]),
    );
    store.setDisplayValue("view-distance", "14");
    expect(store.snapshot().changes).toEqual([
      expect.objectContaining({
        key: "view-distance",
        before: 10,
        after: 14,
        restartRequired: true,
      }),
    ]);
    expect(store.snapshot().restartRequired).toBe(true);
    expect(store.serializeSelectedFile()).toBe("view-distance=14\n");
  });

  it("keeps invalid display input without corrupting serialized content", () => {
    const store = loadedStore("max-players=20\n", fileSchema([baseField()]));
    store.setDisplayValue("max-players", "0");
    const snapshot = store.snapshot();
    expect(snapshot.fields["max-players"]!.displayValue).toBe("0");
    expect(snapshot.fields["max-players"]!.issues).toEqual([
      expect.objectContaining({ code: "range" }),
    ]);
    expect(snapshot.dirty).toBe(false);
    expect(store.serializeSelectedFile()).toBe("max-players=20\n");
  });

  it("redacts secret values from change summaries and immutable snapshots", () => {
    const store = loadedStore(
      "password=old-secret\n",
      fileSchema([
        baseField({
          key: "password",
          type: "secret",
          min: undefined,
          max: undefined,
          sensitive: true,
        }),
      ]),
    );
    store.setDisplayValue("password", "new-secret");
    const snapshot = store.snapshot();
    expect(JSON.stringify(snapshot)).not.toContain("old-secret");
    expect(JSON.stringify(snapshot)).not.toContain("new-secret");
    expect(snapshot.changes[0]).toEqual(
      expect.objectContaining({ before: null, after: null, sensitive: true }),
    );
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.fields)).toBe(true);
  });
});
