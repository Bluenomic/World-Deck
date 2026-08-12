# World Deck - Tauri Desktop Engine

This directory contains the Rust backend for World Deck, built using Tauri v2.

---

## Core Responsibilities

- Native File Explorer Dialogs: Integrated via the `rfd` crate for workspace folder selection.
- Workspace File System I/O: Synchronous and asynchronous reading, writing, and listing of `project_<id>.json` files directly to user-selected local directories.
- Window Management: Custom window control IPC commands for minimize, maximize toggle, and close.

---

## Rust Module Overview

- `src/lib.rs`: Tauri command registration and application initialization.
- `src/storage.rs`: File system storage engine for reading, writing, listing, and deleting project JSON files.
- `src/models.rs`: Rust data structures (`WorldProject`, `WorldCard`, `CardConnection`, `WorldDeck`, `WorldDocument`, etc.) with Serde camelCase serialization.

---

## Build Commands

```bash
# Check Rust code
cargo check

# Run desktop dev environment
npx tauri dev

# Compile release executables and installers
npx tauri build
```
