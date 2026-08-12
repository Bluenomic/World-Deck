# World Deck

A native, canvas-based worldbuilding application designed for writers, game designers, and worldbuilders. Map, structure, and visualize complex fictional worlds with interconnected cards, timelines, interactive canvases, and document managers.

---

## Overview

World Deck provides a visual workspace for crafting narrative universes. Built with React 19, Vite, TypeScript, Tailwind CSS, and Tauri v2 (Rust), it combines high-performance web graphics with transparent local desktop file system storage.

All project data is saved directly to your chosen local directory as human-readable JSON files (`project_<id>.json`). No cloud lock-in, no proprietary databases.

---

## Key Features

### Interactive Worldbuilding Canvas
- Free-form canvas navigation with smooth panning, zooming, and cursor-focal zoom.
- Bezier curve connection handles for linking cards with customizable relationship types.
- Auto-layout engines (Grid, Horizontal, Vertical, Radial) for organizing selected nodes.
- Full undo/redo history stack (up to 50 steps).

### Smart Card System
- Seven core categories: Character, Faction, Location, Lore, Timeline, Item, and Realm.
- Rich metadata: Title, Subtitle, Summary, Detailed Lore, Tags, Custom Attributes, and Gallery.
- Cover Image Focal Point Adjuster: Interactive 1:1 touch-drag panning for framing cover artwork.
- Resizable card containers with dynamic height and boundary enforcement.
- Cross-card referencing using `@CardTitle` mentions.

### Comprehensive View Modes
- Canvas View: Primary visual map with card nodes and relationship links.
- Library View: Searchable grid and list view with empty-area quick action context menus.
- Timeline View: Chronological event tracking across multi-track narrative timelines.
- Documents View: Long-form manuscript and guide editor with interactive card mentions.

### Native Workspace Architecture
- Direct integration with local file systems via Tauri v2 and Rust `rfd` dialogs.
- Workspace Folder Isolation: Complete data separation per user-selected directory.
- Real-time auto-saving to `project_<id>.json` files with strict race condition prevention.
- Explicit Workspace Project Manager for creating and switching projects within local folders.

---

## Technology Stack

- Frontend Core: React 19, TypeScript, Vite
- Styling: Tailwind CSS, Vanilla CSS design tokens
- Icons: Lucide React
- Desktop Engine: Tauri v2 (Rust)
- File System & Dialogs: Rust `rfd` crate (Native OS File Explorer)
- Storage Format: Standalone JSON (`project_<id>.json`)

---

## Project Structure

```
World-Deck/
|-- src/
|   |-- components/
|   |   |-- Canvas.tsx                 # Interactive node canvas
|   |   |-- WorldCardNode.tsx          # Card node renderer with resizers
|   |   |-- CardEditorModal.tsx        # Card editor modal
|   |   |-- ImageFocalAdjusterModal.tsx# Cover image focal point adjuster
|   |   |-- LibraryView.tsx            # Library grid/list view with context menus
|   |   |-- TimelineView.tsx           # Multi-track narrative timeline
|   |   |-- DocumentsView.tsx          # Document editor with card mentions
|   |   |-- WorkspaceLandingScreen.tsx # Workspace folder landing screen
|   |   |-- WorldManagerModal.tsx      # Multi-project workspace manager
|   |   +-- Navbar.tsx                 # Top navigation and window controls
|   |-- i18n/                          # Translations (Indonesian & English)
|   |-- utils/                         # Storage wrappers and Tauri IPC bridge
|   |-- App.tsx                        # Main application container
|   +-- types.ts                       # Type definitions
|-- src-tauri/
|   |-- src/
|   |   |-- lib.rs                     # Tauri command handler registrations
|   |   |-- storage.rs                 # Native Rust file system storage engine
|   |   +-- models.rs                  # Rust data structures for project JSON
|   |-- Cargo.toml                     # Rust dependencies (Tauri, Serde, rfd)
|   +-- tauri.conf.json                # Application configuration
+-- package.json
```

---

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- Rust and Cargo (for Tauri desktop builds)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Bluenomic/World-Archive.git
   cd World-Archive
   ```

2. Install JavaScript dependencies:
   ```bash
   npm install
   ```

3. Run in web development mode:
   ```bash
   npm run dev
   ```

4. Run as native desktop application:
   ```bash
   npx tauri dev
   ```

---

## Build and Distribution

### Production Web Build
```bash
npm run build
```

### Production Desktop Executable
```bash
npx tauri build
```

Output installers and binaries are generated at:
- Setup Installer (.exe): `src-tauri/target/release/bundle/nsis/World Deck_0.1.0_x64-setup.exe`
- MSI Installer (.msi): `src-tauri/target/release/bundle/msi/World Deck_0.1.0_x64_en-US.msi`
- Standalone Executable (.exe): `src-tauri/target/release/app.exe`

---

## License

This project is open source and available under the MIT License.
