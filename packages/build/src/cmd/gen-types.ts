#!/usr/bin/env node
import { genTypes } from "../gen-types";

// Expected signature: genTypes(withFiles: string[], worldName: string, typePath: string, witPath: string)
// CLI usage: gen-types <world-name> [additional-wit-files...] [--wit-path=<path>] [--out-dir=<path>]
// <world-name>: WIT world name to generate types for
// [additional-wit-files...]: optional extra WIT files to include alongside built-ins
// [--wit-path=<path>]: directory to copy built-in WIT definitions into (default: "wit-out")
// [--out-dir=<path>]: output directory for generated TypeScript types (default: "types")

let args = process.argv.slice(2);
let witPath: string | undefined;
let outDir: string | undefined;
const additionalFiles: string[] = [];

args = args.filter((arg) => {
  if (arg.startsWith("--temp-wit-path=")) {
    witPath = arg.slice(16);
    return false;
  }
  if (arg.startsWith("--out-dir=")) {
    outDir = arg.slice(10);
    return false;
  }
  return true;
});

if (args.length < 1) {
  console.error(
    "Usage: gen-types <world-name> [additional-wit-files...] [--wit-path=<path>] [--out-dir=<path>]",
  );
  process.exit(1);
}

// Non-null assertion safe due to length check above
const worldName = args[0]!;
additionalFiles.push(...args.slice(1));

await genTypes(additionalFiles, worldName, outDir, witPath);
