# Notane LibSQL Management

Native desktop application to run and manage self-hosted **libSQL (`sqld`)** database server instances. Built with **Tauri v2 (Rust)** and **SolidJS + Tailwind CSS**.

## Features

- **Embedded sqld Server Engine:** Ships with bundled `sqld` binary. No manual compilation or Docker daemon needed.
- **Multi-Instance Support:** Run multiple independent database servers on different ports, with dedicated storage directories and isolated process lifecycles.
- **Process Supervision:** Starts, stops, and gracefully shuts down `sqld` processes with automatic crash detection and recovery backoff.
- **Namespace Management:** Create, fork, delete, and trigger WAL checkpoints on isolated database namespaces directly through the Admin API.
- **Automated JWT Minting:** Generates Ed25519 keypairs and produces signed JWT auth tokens (`rw` / `ro`) with configurable expiration and instant connection strings (`http://` and `libsql://`).
- **Live Output Streaming:** Real-time log monitoring from `sqld` stdout and stderr with search filtering, line limiting, and export options.
- **Encrypted Local Storage:** Sensitive credentials (admin auth keys, private Ed25519 signing keys) are encrypted locally with AES-256-GCM in SQLite.

## Prerequisites

- **Node.js** (v18+) & **pnpm** (v9+)
- **Rust** (v1.78+)

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Download or verify the bundled `sqld` engine (optional, automated in CI):**
   ```bash
   ./scripts/download-sqld.sh
   ```

3. **Run the desktop application in development mode:**
   ```bash
   pnpm tauri dev
   ```

4. **Build the production desktop binary:**
   ```bash
   pnpm tauri build
   ```

## Documentation & Guides

- [Complete User Guide & Client Connection Guide](docs/user-guide.md): Tata cara penggunaan lengkap, perbedaan HTTP Port vs Admin Port, Smart Reverse Proxy, dan tutorial koneksi dari libSQL Studio, Mobile Android (POS), TypeScript/Node, Python, dan cURL.
- [Requirements & Architecture Specification](docs/requirements.md)

## Client Connection Example

Once an instance and namespace are running, connect using any official libSQL client (such as `@libsql/client`):

```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  url: "http://127.0.0.1:8080/v1/namespaces/my_database",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...",
});

const result = await client.execute("SELECT 1;");
console.log(result);
```

## Security & Architecture

- **No Unauthenticated Admin Exposure:** Every instance generates a random admin bearer token by default.
- **Graceful Shutdown:** On window close or application exit, a `SIGTERM` signal is dispatched to all child instances to allow SQLite Write-Ahead Logs (WAL) to flush cleanly before exiting.
