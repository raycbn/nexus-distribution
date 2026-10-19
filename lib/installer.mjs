import { createHash } from "node:crypto";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const REPOSITORY = "raycbn/nexus-distribution";
const API_BASE = "https://api.github.com/repos/" + REPOSITORY;
const CLI_VERSION = "0.1.0";

export function parseArgs(args) {
  const result = { help: false, dryRun: false, release: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--release") {
      const value = args[++i];
      if (!value || value.startsWith("-")) {
        throw new Error("--release necesita una versión, por ejemplo v1.0.0-beta.3.");
      }
      if (!/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)) {
        throw new Error("Versión no válida. Usa el formato v1.0.0-beta.3.");
      }
      result.release = value.startsWith("v") ? value : "v" + value;
    } else {
      throw new Error("Opción desconocida: " + arg + ". Ejecuta --help para ver las opciones.");
    }
  }
  return result;
}

export function assetNameForPlatform(platform) {
  if (platform === "win32") return "NEXUS-Windows.zip";
  if (platform === "linux") return "NEXUS-Linux.tar.gz";
  if (platform === "darwin") {
    throw new Error("NEXUS todavía no publica un paquete de instalación para macOS.");
  }
  throw new Error("Sistema operativo no compatible: " + platform + ".");
}

export function selectAsset(release, platform) {
  const expectedName = assetNameForPlatform(platform);
  const asset = release.assets?.find((item) => item.name === expectedName);
  if (!asset) throw new Error("La release " + release.tag_name + " no contiene " + expectedName + ".");
  if (!asset.browser_download_url || !/^https:\/\/github\.com\//.test(asset.browser_download_url)) {
    throw new Error("La release contiene una URL inesperada; se cancela por seguridad.");
  }
  const digest = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? "");
  if (!digest) {
    throw new Error("GitHub no ha proporcionado un SHA-256 válido para " + asset.name + "; se cancela por seguridad.");
  }
  return { ...asset, expectedSha256: digest[1].toLowerCase() };
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "nexus-installer/" + CLI_VERSION,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error("GitHub respondió HTTP " + response.status + " al consultar la release.");
  }
  return response.json();
}

export async function getRelease(version) {
  if (version) {
    const release = await fetchGitHubJson(API_BASE + "/releases/tags/" + encodeURIComponent(version));
    if (release.draft || !release.published_at) {
      throw new Error("La release " + version + " no está publicada.");
    }
    return release;
  }
  const releases = await fetchGitHubJson(API_BASE + "/releases?per_page=100");
  if (!Array.isArray(releases)) throw new Error("La lista de releases de GitHub tiene un formato inesperado.");
  const published = releases
    .filter((release) => !release.draft && release.published_at)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  if (!published.length) throw new Error("No hay ninguna release pública de NEXUS.");
  return published[0];
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: { "User-Agent": "nexus-installer/" + CLI_VERSION },
    redirect: "follow",
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok || !response.body) {
    throw new Error("No se pudo descargar el paquete (HTTP " + response.status + ").");
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: "wx" }));
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: false, ...options });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error("El instalador terminó con " +
        (signal ? "señal " + signal : "código " + code) + "."));
    });
  });
}

function quotePowerShellLiteral(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

async function findInstaller(directory, filename, maxDepth = 3, depth = 0) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
      return path.join(directory, entry.name);
    }
  }
  if (depth >= maxDepth) return null;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = await findInstaller(path.join(directory, entry.name), filename, maxDepth, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function helpText() {
  return [
    "NEXUS installer " + CLI_VERSION,
    "",
    "Uso:",
    "  npx nexus-installer                 Instala la última release publicada de NEXUS",
    "  npx nexus-installer --release TAG   Instala una versión concreta",
    "  npx nexus-installer --dry-run       Muestra la versión y el paquete, sin instalar",
    "  npx nexus-installer --help          Muestra esta ayuda",
    "",
    "Requisitos:",
    "  Node.js 20 o superior, Internet y Docker Desktop (Windows)",
    "  o Docker Engine + Compose v2 (Linux). Docker no se instala automáticamente.",
    "",
    "El lanzador descarga el paquete oficial de nexus-distribution y valida su SHA-256",
    "antes de ejecutar el instalador incluido. No descarga ni expone el repositorio privado.",
  ].join("\n");
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(helpText());
    return;
  }

  const release = await getRelease(options.release);
  const selectedAsset = selectAsset(release, process.platform);
  console.log("NEXUS " + release.tag_name + " · " + process.platform);
  console.log("Paquete: " + selectedAsset.name);
  console.log("SHA-256: " + selectedAsset.expectedSha256);
  if (options.dryRun) {
    console.log("Modo de prueba: no se descargará ni ejecutará nada.");
    return;
  }

  const workDir = await mkdtemp(path.join(os.tmpdir(), "nexus-installer-"));
  try {
    const archivePath = path.join(workDir, selectedAsset.name);
    console.log("\nDescargando el paquete oficial...");
    await downloadFile(selectedAsset.browser_download_url, archivePath);
    console.log("Verificando SHA-256...");
    const actualSha256 = await sha256File(archivePath);
    if (actualSha256 !== selectedAsset.expectedSha256) {
      throw new Error("El SHA-256 no coincide con el publicado por GitHub. No se ejecutará el paquete.");
    }

    const extractDir = path.join(workDir, "package");
    await mkdir(extractDir);
    if (process.platform === "win32") {
      const command = "Expand-Archive -LiteralPath " + quotePowerShellLiteral(archivePath) +
        " -DestinationPath " + quotePowerShellLiteral(extractDir) + " -Force";
      await runProcess("powershell.exe", [
        "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command,
      ]);
      const script = await findInstaller(extractDir, "Install-NEXUS.ps1");
      if (!script) throw new Error("El paquete no contiene Install-NEXUS.ps1.");
      console.log("\nSe iniciará el instalador oficial de Windows. Revisa sus mensajes y confirmaciones.");
      await runProcess("powershell.exe", [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
      ], { cwd: path.dirname(script) });
    } else {
      await runProcess("tar", ["-xzf", archivePath, "-C", extractDir]);
      const script = await findInstaller(extractDir, "install-nexus.sh");
      if (!script) throw new Error("El paquete no contiene install-nexus.sh.");
      console.log("\nSe iniciará el instalador oficial de Linux. Revisa sus mensajes y confirmaciones.");
      await runProcess("bash", [script], { cwd: path.dirname(script) });
    }
    console.log("\nEl instalador de NEXUS ha terminado correctamente.");
    await rm(workDir, { recursive: true, force: true });
  } catch (error) {
    console.error("\nLos archivos descargados se conservan para diagnóstico en: " + workDir);
    throw error;
  }
}
