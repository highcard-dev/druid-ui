#!/usr/bin/env node
import { genTypes } from "../index";
import { parseOptions } from "./options";
try {
  await genTypes(parseOptions(process.argv.slice(2), true));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
