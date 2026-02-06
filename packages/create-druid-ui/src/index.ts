#!/usr/bin/env node

import { downloadTemplate } from "giget";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const projectName = process.argv[2];
const projectPath = process.argv[3];

if (!projectName) {
  console.error("Usage: create-druid-ui <project-name> [path]");
  process.exit(1);
}

const projectDir = projectPath ? resolve(projectPath) : resolve(projectName);

async function main() {
  console.log(`Creating druid-ui project "${projectName}" in ${projectDir}...`);

  await downloadTemplate("gh:highcard-dev/druid-ui/examples/starter", {
    dir: projectDir,
    force: false,
  });

  console.log("Project files created.");
  console.log("Installing dependencies...");

  try {
    execSync("npm install", { cwd: projectDir, stdio: "inherit" });
    console.log("");
    console.log("Done! To get started:");
    console.log("");
    console.log(`  cd ${projectName}`);
    console.log("  npm run dev");
    console.log("");
  } catch {
    console.error("");
    console.error("npm install failed. You can run it manually:");
    console.error(`  cd ${projectName} && npm install`);
    console.error("");
  }
}

main().catch(console.error);
