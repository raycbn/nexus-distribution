#!/usr/bin/env node
import { main } from "../lib/installer.mjs";

main().catch((error) => {
  console.error("\nNEXUS installer failed:", error.message);
  process.exitCode = 1;
});
