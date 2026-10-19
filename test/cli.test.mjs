import test from "node:test";
import assert from "node:assert/strict";
import { assetNameForPlatform, parseArgs, selectAsset } from "../lib/installer.mjs";

test("defaults to the latest release without extra options", () => {
  assert.deepEqual(parseArgs([]), { help: false, dryRun: false, release: null });
});

test("accepts explicit beta release tags with or without the v prefix", () => {
  assert.equal(parseArgs(["--release", "1.0.0-beta.3"]).release, "v1.0.0-beta.3");
  assert.equal(parseArgs(["--release", "v1.0.0-beta.3"]).release, "v1.0.0-beta.3");
});

test("supports help and non-installing dry-run options", () => {
  assert.equal(parseArgs(["--help"]).help, true);
  assert.equal(parseArgs(["--dry-run"]).dryRun, true);
});

test("rejects malformed versions and unknown flags", () => {
  assert.throws(() => parseArgs(["--release", "../main"]), /Versión no válida/);
  assert.throws(() => parseArgs(["--release"]), /necesita una versión/);
  assert.throws(() => parseArgs(["--quiet"]), /Opción desconocida/);
});

test("maps Windows and Linux to the matching distribution archive", () => {
  assert.equal(assetNameForPlatform("win32"), "NEXUS-Windows.zip");
  assert.equal(assetNameForPlatform("linux"), "NEXUS-Linux.tar.gz");
  assert.throws(() => assetNameForPlatform("darwin"), /macOS/);
});

test("selects only the matching archive and requires a SHA-256 digest", () => {
  const release = {
    tag_name: "v1.0.0-beta.3",
    assets: [
      {
        name: "NEXUS-Windows.zip",
        browser_download_url: "https://github.com/raycbn/nexus-distribution/releases/download/v1.0.0-beta.3/NEXUS-Windows.zip",
        digest: "sha256:" + "a".repeat(64),
      },
    ],
  };
  assert.equal(selectAsset(release, "win32").expectedSha256, "a".repeat(64));
  assert.throws(() => selectAsset(release, "linux"), /no contiene NEXUS-Linux.tar.gz/);
  assert.throws(() => selectAsset({
    ...release,
    assets: [{ ...release.assets[0], digest: null }],
  }, "win32"), /SHA-256 válido/);
});

test("rejects download URLs outside the expected GitHub release host", () => {
  const release = {
    tag_name: "v1.0.0-beta.3",
    assets: [{
      name: "NEXUS-Windows.zip",
      browser_download_url: "https://example.com/installer.zip",
      digest: "sha256:" + "a".repeat(64),
    }],
  };
  assert.throws(() => selectAsset(release, "win32"), /URL inesperada/);
});
