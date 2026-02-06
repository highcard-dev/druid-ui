#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const projectName = process.argv[2];
const projectPath = process.argv[3];

if (!projectName) {
  console.error("Usage: create-druid-ui <project-name> [path]");
  process.exit(1);
}

const projectDir = projectPath ? resolve(projectPath) : resolve(projectName);

console.log(`Creating druid-ui project in ${projectDir}...`);

mkdirSync(join(projectDir, "src"), { recursive: true });

const packageJson = {
  name: projectName,
  private: true,
  version: "0.0.0",
  type: "module",
  scripts: {
    build: "druid-ui-build src/index.tsx",
  },
  dependencies: {
    "@druid-ui/component": "next",
    "@druid-ui/build": "next",
  },
};

writeFileSync(
  join(projectDir, "package.json"),
  JSON.stringify(packageJson, null, "\t") + "\n",
);

const tsconfig = {
  compilerOptions: {
    target: "ESNext",
    module: "ESNext",
    moduleResolution: "bundler",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    jsx: "react",
    jsxFactory: "d",
    jsxFragmentFactory: "Fragment",
    outDir: "./dist",
  },
  files: ["node_modules/@druid-ui/component/src/jsx.d.ts"],
  include: ["src/**/*"],
  exclude: ["node_modules"],
};

writeFileSync(
  join(projectDir, "tsconfig.json"),
  JSON.stringify(tsconfig, null, "\t") + "\n",
);

writeFileSync(join(projectDir, "src", "index.tsx"), "");

console.log("Project files created.");
console.log("Installing dependencies...");

try {
  execSync("npm install", { cwd: projectDir, stdio: "inherit" });
  console.log("");
  console.log("Done! To get started:");
  console.log("");
  console.log(`  cd ${projectName}`);
  console.log("  npm run build");
  console.log("");
} catch {
  console.error("");
  console.error("npm install failed. You can run it manually:");
  console.error(`  cd ${projectName} && npm install`);
  console.error("");
}
