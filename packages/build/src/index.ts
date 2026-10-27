import { build } from "esbuild";
import { componentize } from "componentize-qjs";
import { generateGuestTypes } from "@bytecodealliance/jco-transpile";
import {
  componentNew,
  componentWit,
} from "@bytecodealliance/jco-transpile/wasm-tools";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  copyFile,
  rename,
  rm,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, basename, join } from "node:path";

const require = createRequire(import.meta.url);
const execute = promisify(execFile);
export interface BuildOptions {
  entry: string;
  /** Rust entries point to Cargo.toml; TypeScript entries point to a module. */
  language?: "typescript" | "rust";
  document?: string;
  outDir?: string;
  name?: string;
  witFiles?: string[];
  worldName?: string;
}
export interface BuildResult {
  file: string;
  dependencies: string[];
}

async function rustSources(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["target", ".git", "node_modules"].includes(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await rustSources(file)));
    else if (/\.(rs|toml|lock)$/.test(entry.name)) files.push(file);
  }
  return files;
}

async function compileRust(entry: string, wit: string) {
  let stdout: string;
  try {
    ({ stdout } = await execute(
      "cargo",
      [
        "build",
        "--manifest-path",
        entry,
        "--target",
        "wasm32-unknown-unknown",
        "--release",
        "--locked",
        "--message-format=json-render-diagnostics",
      ],
      {
        cwd: dirname(entry),
        env: { ...process.env, DRUID_WIT_PATH: wit },
        maxBuffer: 16 * 1024 * 1024,
      },
    ));
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stderr?: string;
      stdout?: string;
    };
    if (failure.code === "ENOENT")
      throw new Error(
        "Rust/Cargo is required. Install Rust, then run: rustup target add wasm32-unknown-unknown",
        { cause: error },
      );
    throw new Error(
      `Rust guest build failed:\n${failure.stdout ?? ""}\n${failure.stderr ?? String(error)}`,
      { cause: error },
    );
  }
  const artifacts = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (message) =>
        message.reason === "compiler-artifact" &&
        resolve(message.manifest_path) === entry &&
        message.target.crate_types.includes("cdylib"),
    );
  const file: string | undefined = artifacts
    .at(-1)
    ?.filenames.find((name: string) => name.endsWith(".wasm"));
  if (!file)
    throw new Error(
      "Rust guest must define a cdylib producing a WASM artifact",
    );
  return componentNew(await readFile(file), []);
}

async function withWit<T>(
  options: Pick<BuildOptions, "outDir" | "witFiles" | "worldName">,
  action: (wit: string) => Promise<T>,
): Promise<T> {
  const output = resolve(options.outDir ?? "dist");
  await mkdir(output, { recursive: true });
  const staging = await mkdtemp(join(output, ".wit-"));
  try {
    const base = dirname(require.resolve("@druid-ui/client/wit"));
    const inputs = await Promise.all(
      [
        ...(await readdir(base)).map((file) => join(base, file)),
        ...(options.witFiles ?? []).map((file) => resolve(file)),
      ].map(async (file) => {
        const source = await readFile(file, "utf8");
        const pkg = source.match(/\bpackage\s+([^;\s]+)\s*;/)?.[1];
        if (!pkg) throw new Error(`Missing WIT package declaration: ${file}`);
        return { file, source, pkg };
      }),
    );
    const selectedWorld = options.worldName ?? "openui-client";
    const world = selectedWorld.split("/").pop()!.split("@")[0]!;
    const worldPattern = new RegExp(
      `\\bworld\\s+${world.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`,
    );
    const candidates = inputs.filter(
      (input) =>
        worldPattern.test(input.source) &&
        (!selectedWorld.includes("/") ||
          selectedWorld.startsWith(`${input.pkg.split("@")[0]}/`)),
    );
    if (candidates.length !== 1)
      throw new Error(`WIT world must resolve unambiguously: ${selectedWorld}`);
    const rootPackage = candidates[0]!.pkg;
    const names = new Set<string>();
    for (const input of inputs) {
      const relative =
        input.pkg === rootPackage
          ? basename(input.file)
          : join(
              "deps",
              input.pkg.replace(/[^a-zA-Z0-9_.-]/g, "-"),
              basename(input.file),
            );
      if (names.has(relative))
        throw new Error(`WIT filename collision: ${relative}`);
      names.add(relative);
      const destination = join(staging, relative);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(input.file, destination);
    }
    return await action(staging);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function genTypes(
  options: Pick<BuildOptions, "outDir" | "witFiles" | "worldName"> = {},
): Promise<void> {
  await withWit(options, async (wit) => {
    const files = await generateGuestTypes(wit, {
      worldName: options.worldName ?? "openui-client",
    });
    for (const [name, content] of Object.entries(files)) {
      const output = resolve(options.outDir ?? "dist", name);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, content);
    }
  });
}

export async function buildWasm(options: BuildOptions): Promise<BuildResult> {
  const entry = resolve(options.entry);
  const outDir = resolve(options.outDir ?? "dist");
  const name = options.name ?? basename(entry).replace(/\.[^.]+$/, "");
  if (!/^[a-zA-Z0-9_-]+$/.test(name))
    throw new Error("Artifact name must be a filename without a path");
  await mkdir(outDir, { recursive: true });
  const staging = await mkdtemp(join(outDir, ".build-"));
  try {
    let component: Uint8Array;
    let sources: string[];
    if (options.language === "rust") {
      component = await withWit({ ...options, outDir: staging }, (wit) =>
        compileRust(entry, wit),
      );
      sources = await rustSources(dirname(entry));
    } else {
      const sourcePath = join(staging, `${name}.js`);
      const bundle = await build({
        entryPoints: [entry],
        bundle: true,
        format: "esm",
        platform: "neutral",
        outfile: sourcePath,
        metafile: true,
        plugins: [
          {
            name: "wit-imports",
            setup(builder) {
              builder.onResolve(
                { filter: /^[a-z][a-z0-9-]*:[^/]+\// },
                (args) => ({ path: args.path, external: true }),
              );
            },
          },
        ],
      });
      const jsSource = await readFile(sourcePath, "utf8");
      const result = await withWit({ ...options, outDir: staging }, (wit) =>
        componentize({
          jsSource,
          jsPath: sourcePath,
          witPath: wit,
          world: options.worldName ?? "openui-client",
          stubWasi: true,
          optSize: true,
        }),
      );
      component = result.component;
      sources = Object.keys(bundle.metafile!.inputs).map((file) =>
        resolve(file),
      );
    }
    if (
      !/^\s*export druid:openui\/client;/m.test(await componentWit(component))
    ) {
      throw new Error("The selected WIT world must export druid:openui/client");
    }
    const candidate = join(staging, `${name}.wasm`);
    await writeFile(candidate, component);
    if (options.document) {
      await copyFile(
        resolve(options.document),
        join(staging, `${name}.openui`),
      );
      await rename(
        join(staging, `${name}.openui`),
        join(outDir, `${name}.openui`),
      );
    }
    const file = join(outDir, `${name}.wasm`);
    await rename(candidate, file);
    const base = dirname(require.resolve("@druid-ui/client/wit"));
    return {
      file,
      dependencies: [
        ...sources,
        ...(options.witFiles ?? []).map((file) => resolve(file)),
        ...(await readdir(base)).map((file) => join(base, file)),
        ...(options.document ? [resolve(options.document)] : []),
      ],
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
