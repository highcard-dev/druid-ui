import { genTypes } from "../gen-types";

// Expected signature: genTypes(witPath: string, withFiles: string[], typePath: string)
// CLI usage: gen-types <wit-path> <type-path> [additional-wit-files...]
// <wit-path>: directory to copy built-in WIT definitions into (will be created)
// <type-path>: output directory for generated TypeScript types
// [additional-wit-files...]: optional extra WIT files to include alongside built-ins

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: ts-node src/build/cmd/gen-types.ts <world-name> [additional-wit-files...]"
  );
  process.exit(1);
}

// Non-null assertions safe due to length check above
const worldName = args[0]!;
const additionalFiles = args.slice(1); // optional list
await genTypes(additionalFiles, worldName);
