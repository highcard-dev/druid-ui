#!/usr/bin/env node

import { downloadTemplate } from "giget";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const projectName = args.find((arg) => !arg.startsWith("-"));
const templateFlag =
  args.indexOf("-t") !== -1 ? args.indexOf("-t") : args.indexOf("--template");
const template = templateFlag !== -1 ? args[templateFlag + 1] : "starter";

if (!projectName) {
  console.log("Usage: create-druid-ui <project-name> [-t template]");
  console.log(
    "Templates: starter (default), starter-component, simple, simple-extended",
  );
  process.exit(1);
}

const projectDir = resolve(projectName);

async function main() {
  console.log(`Creating "${projectName}" with template "${template}"...`);

  await downloadTemplate(`gh:highcard-dev/druid-ui/examples/${template}`, {
    dir: projectDir,
    force: false,
  });

  console.log("Installing dependencies...");

  try {
    execSync("npm install", { cwd: projectDir, stdio: "inherit" });
    console.log(`\nDone! Run:\n  cd ${projectName}\n  npm run dev\n`);
  } catch {
    console.error(
      `\nnpm install failed. Run manually:\n  cd ${projectName} && npm install\n`,
    );
  }
}

main().catch(console.error);
