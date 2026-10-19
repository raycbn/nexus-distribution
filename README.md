# NEXUS distribution

NEXUS is proprietary self-hosted software. Its application source repository remains private. This public repository distributes the installation bundles and a small bootstrap CLI; it does not contain the application source. The npm CLI has its own terms in CLI-LICENSE.md; NEXUS-DISTRIBUTION-LICENSE.md is the license for the application distribution downloaded by the CLI.

## Quick install with npx

Requirements: **Node.js 20 or later**, internet access, and Docker Desktop with Compose v2 on Windows or Docker Engine with Compose v2 on Linux. Docker is a separate prerequisite and is not installed automatically.

```bash
npx nexus-installer
```

Install a specific published release:

```bash
npx nexus-installer --release v1.0.0-beta.3
```

Preview which release and archive would be selected without downloading or installing anything:

```bash
npx nexus-installer --dry-run
```

The launcher downloads the official platform archive from [NEXUS releases](https://github.com/raycbn/nexus-distribution/releases), checks its SHA-256 digest against the digest exposed by GitHub, and only then starts the existing platform installer. Read and follow that installer's prompts. The first startup may download container images and local AI models.

The default local web address is [http://localhost:8080](http://localhost:8080). On the first visit, create an organization and administrator at `/setup`; for later visits use `/login`.

## Install from a compressed package

Prefer a manual/offline-friendly download? Get the appropriate archive from the [latest published release](https://github.com/raycbn/nexus-distribution/releases):

- **Windows:** `NEXUS-Windows.zip`. Extract it and double-click `Install-NEXUS.cmd`.
- **Linux:** `NEXUS-Linux.tar.gz`. Extract it and run `./install-nexus.sh`.

The archives include the platform installer, local manager, configuration template, license and software bills of materials/checksums. They contain no private application source code.

## Security and license

- NEXUS is not Open Source. No access to or redistribution rights for the private application source are granted by the public installer or distribution packages.
- The npx launcher verifies the downloaded archive's SHA-256 before it executes the included installer.
- Real remediation writes remain disabled by default. Review the official release notes and keep secrets and backups private.
- Do not expose the default local installation directly to the Internet.

See the [release notes and packages](https://github.com/raycbn/nexus-distribution/releases) for the version you install.
