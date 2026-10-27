import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
await mkdir(resolve(".verification"), { recursive: true });
const work = await mkdtemp(resolve(".verification/packages-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout;
}
const packed = new Map();
for (const name of ["client", "host", "build", "create-druid-ui"]) {
  const [metadata] = JSON.parse(
    run(
      npm,
      ["pack", "--json", "--ignore-scripts", "--pack-destination", work],
      resolve("packages", name),
    ),
  );
  const files = metadata.files.map((file) => file.path);
  assert.ok(
    files.some((file) =>
      file.startsWith(name === "create-druid-ui" ? "bin/" : "dist/"),
    ),
  );
  if (name === "client") {
    assert.ok(files.includes("wit/client.wit"));
    assert.ok(files.includes("generated/openui-client.d.ts"));
  }
  if (name === "host") {
    assert.ok(
      files.some(
        (file) => file.includes("wasm.worker") && file.endsWith(".js"),
      ),
    );
    assert.ok(files.includes("dist/index.d.ts"));
  }
  if (name === "create-druid-ui") {
    for (const template of ["starter", "starter-client", "custom-wit"]) {
      assert.ok(files.includes(`templates/${template}/package.json`));
      for (const file of ["Cargo.toml", "Cargo.lock", "src/lib.rs"])
        assert.ok(
          files.includes(`templates/${template}/guest/${file}`),
          `Missing Rust template source: ${template}/${file}`,
        );
      assert.ok(
        !files.some((file) =>
          file.startsWith(`templates/${template}/guest/target/`),
        ),
      );
      assert.ok(!files.includes(`templates/${template}/src/client/index.ts`));
    }
  }
  assert.ok(
    !files.some(
      (file) => file.includes("node_modules/") || file.endsWith(".test.tsx"),
    ),
  );
  packed.set(metadata.name, join(work, metadata.filename));
}

const unpacked = join(work, "scaffolder");
await mkdir(unpacked);
run("tar", ["-xzf", packed.get("create-druid-ui"), "-C", unpacked]);
const command = join(unpacked, "package/bin/create.js");
for (const template of ["starter", "starter-client", "custom-wit"]) {
  const directory = join(work, template);
  run(process.execPath, [
    command,
    directory,
    "--template",
    template,
    "--no-install",
  ]);
  const manifestFile = join(directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  for (const section of ["dependencies", "devDependencies"])
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (packed.has(dependency))
        manifest[section][dependency] = `file:${packed.get(dependency)}`;
    }
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  run(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    directory,
  );
  run(npm, ["run", "build"], directory);
  assert.ok((await readdir(join(directory, "dist"))).length > 0);
  assert.ok(
    (await readFile(join(directory, "AGENTS.md"), "utf8")).includes(
      "@druid-ui/client",
    ),
  );
  assert.ok(
    (await readFile(join(directory, "AGENTS.md"), "utf8")).includes(
      "Prefer Rust",
    ),
  );
  console.log(`PASS packed/scaffolded ${template}`);
}
const existing = spawnSync(
  process.execPath,
  [command, join(work, "starter"), "--no-install"],
  { encoding: "utf8" },
);
assert.notEqual(
  existing.status,
  0,
  "Scaffolder must refuse to overwrite an existing project",
);
const defaultDirectory = join(work, "default-rust");
run(process.execPath, [command, defaultDirectory, "--no-install"]);
assert.ok(
  (await readFile(join(defaultDirectory, "guest/src/lib.rs"), "utf8")).includes(
    "SettingsClient",
  ),
);
assert.ok(
  (await readFile(join(defaultDirectory, "vite.config.ts"), "utf8")).includes(
    'language: "rust"',
  ),
);
console.log("PASS default template prefers Rust");
console.log(`Packed-package fixtures retained in ${work}`);
