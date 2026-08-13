import { describe, expect, it } from "vitest";
import { iniAdapter, keyValueAdapter, unrealIniAdapter } from "./ini.js";

describe("iniAdapter", () => {
  it("changes only a value in the selected section", () => {
    const source =
      "; generated\r\n[Server]\r\nName = Old ; keep this\r\nPlayers=20\r\n\r\n[Other]\r\nName=Untouched\r\n";
    const document = iniAdapter.parse(source);
    expect(iniAdapter.get(document, "Server.Name")).toBe("Old");
    const changed = iniAdapter.set(document, "Server.Name", "Druid");
    expect(iniAdapter.serialize(changed)).toBe(
      source.replace("Name = Old", "Name = Druid"),
    );
  });

  it("uses the last duplicate key and keeps all other lines", () => {
    const source = "[Server]\nName=old\nName=new\n";
    const changed = iniAdapter.set(iniAdapter.parse(source), "Server.Name", "final");
    expect(iniAdapter.get(changed, "Server.Name")).toBe("final");
    expect(iniAdapter.serialize(changed)).toBe(
      "[Server]\nName=old\nName=final\n",
    );
  });

  it("preserves an untouched document byte-for-byte", () => {
    const source = "# comment\nroot=value\n[Section]\nempty=\n";
    expect(iniAdapter.serialize(iniAdapter.parse(source))).toBe(source);
  });
});

describe("unrealIniAdapter", () => {
  it("changes only an Unreal INI value in the selected section", () => {
    const source =
      "[/Script/ShooterGame.ShooterGameUserSettings]\r\nServerPassword=\r\nDifficultyOffset=0.2\r\n";
    const changed = unrealIniAdapter.set(
      unrealIniAdapter.parse(source),
      "/Script/ShooterGame.ShooterGameUserSettings.DifficultyOffset",
      1,
    );
    expect(unrealIniAdapter.serialize(changed)).toBe(
      source.replace("0.2", "1"),
    );
  });

  it("retains Unreal array prefixes", () => {
    const source = "[Rules]\n+AllowedClasses=One\n+AllowedClasses=Two\n";
    const changed = unrealIniAdapter.set(
      unrealIniAdapter.parse(source),
      "Rules.+AllowedClasses",
      "Three",
    );
    expect(unrealIniAdapter.serialize(changed)).toBe(
      "[Rules]\n+AllowedClasses=One\n+AllowedClasses=Three\n",
    );
  });
});

describe("keyValueAdapter", () => {
  it("preserves comments and inline spacing while changing one value", () => {
    const source = "// server config\nhostname   Druid\nmaxplayers = 20 // capacity\n";
    const document = keyValueAdapter.parse(source);
    expect(keyValueAdapter.get(document, "hostname")).toBe("Druid");
    expect(
      keyValueAdapter.serialize(keyValueAdapter.set(document, "maxplayers", 64)),
    ).toBe("// server config\nhostname   Druid\nmaxplayers = 64 // capacity\n");
  });
});
