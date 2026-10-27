import type { BuildOptions } from "../index";
export function parseOptions(
  args: string[],
  typesOnly = false,
): BuildOptions & { watch: boolean } {
  const positional: string[] = [];
  const witFiles: string[] = [];
  let worldName = "openui-client";
  let name: string | undefined;
  let document: string | undefined;
  let watch = false;
  let language: BuildOptions["language"];
  for (const arg of args) {
    if (arg === "--watch" || arg === "-w") watch = true;
    else if (arg === "--rust") language = "rust";
    else if (arg.startsWith("--wit=")) witFiles.push(arg.slice(6));
    else if (arg.startsWith("--world-name=")) worldName = arg.slice(13);
    else if (arg.startsWith("--name=")) name = arg.slice(7);
    else if (arg.startsWith("--document=")) document = arg.slice(11);
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (!typesOnly && !positional[0])
    throw new Error(
      "Usage: druid-ui-build <entry.ts|Cargo.toml> [out-dir] [--rust] [--watch] [--wit=file] [--world-name=name] [--name=name]",
    );
  return {
    entry: positional[0] ?? "",
    outDir: typesOnly
      ? (positional[0] ?? "generated")
      : (positional[1] ?? "dist"),
    witFiles,
    worldName,
    ...(name ? { name } : {}),
    ...(document ? { document } : {}),
    watch,
    ...(language ? { language } : {}),
  };
}
