import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

test("npm package exposes the installer as its single executable", async () => {
  assert.equal(packageJson.name, "nexus-installer");
  assert.equal(packageJson.bin, "./bin/nexus-installer.mjs");
  const cliPath = path.join(root, packageJson.bin);
  const cli = await readFile(cliPath, "utf8");
  assert.ok(cli.startsWith("#!/usr/bin/env node\n"));
});

test("package publication runs the test suite first", () => {
  assert.equal(packageJson.scripts.prepublishOnly, "npm test");
});

test("installer and product licenses remain clearly separated", async () => {
  assert.equal(packageJson.license, "SEE LICENSE IN CLI-LICENSE.md");
  assert.ok(packageJson.files.includes("CLI-LICENSE.md"));
  assert.ok(packageJson.files.includes("NEXUS-DISTRIBUTION-LICENSE.md"));
});
