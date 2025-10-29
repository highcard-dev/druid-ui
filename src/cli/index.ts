import { buildWasm } from "./build";

const entryFile = process.argv[2];

if (!entryFile) {
  console.error("Usage: ts-node src/cli/index.ts <entry-file> [out-folder]");
  process.exit(1);
}

const outfolder = process.argv[3] || "./dist";

buildWasm(entryFile, outfolder);
