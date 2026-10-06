# World Deck

A native, canvas-based worldbuilding application designed for writers, game designers, and worldbuilders. Map, structure, and visualize complex fictional worlds with interconnected cards, timelines, interactive canvases, and document managers.

---

## Overview

World Deck provides a visual workspace for crafting narrative universes. Built with React 19, Vite, TypeScript, Tailwind CSS, and Tauri v2 (Rust), it combines high-performance web graphics with transparent local desktop file system storage.

Project data is saved to your chosen directory as human-readable JSON files (`project_<id>.json`). PNG, JPEG, WebP and GIF images are stored in the adjacent `assets/` folder. Keep the folder and JSON files together when moving a workspace. JSON exports embed images for portable sharing. No cloud lock-in or proprietary databases.

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

### Interactive Atlas
- Single-click a pin to select it; double-click to open its linked card, matching Canvas interaction.
- Drag pins to move them. One completed drag creates one undo operation; Escape cancels an active drag.
- Right-click for pin actions, colors, card editing, and map settings. There is no permanent inspector or search/status bar.
- Add a new location card or place existing cards from the gallery. Cancelling a new card leaves no empty card behind.
- Pan with dragging or scrolling; Ctrl/Command + scroll zooms around the pointer. `F` fits the image to the available viewport.
- Keyboard-focus a pin and use arrow keys to move it by 0.1%; Shift + arrow moves it by 1%. Coordinates can also be edited in Pin settings.
- Optional Map settings contain category/deck/tag filters, label visibility, layers, pin icons, and map management.
- Draw routes with at least two points and regions with at least three. Finish creates the object; Escape cancels. Their names, colors, layers, and controlling factions are editable in settings.
- Parent maps and pin links connect world, continent, city, and building maps. Cyclic parent relationships are rejected.
- Choose a Timeline event to record a pin position from that event onwards on the same track. Base mode edits the default position. Region/route visibility uses an inclusive start and exclusive end event; events are ordered by their Timeline x-position, not parsed date labels.
- Card readers expose links back to maps, Timeline events, and documents that use the card.

### Reliability and Offline Use
- Undo/redo includes maps, documents, decks, cards and Timeline data, with up to 50 undo operations.
- Writes are queued in order. Failed saves show a retry notification; successful saves do not add UI chrome.
- Native saves write a temporary file and atomically replace the primary without deleting it first. A `.json.bak` copy retains the last valid version.
- If a primary project is missing or unreadable, workspace loading attempts its backup. Assets are retained for backup and undo recovery; unused images are not automatically removed.
- Tailwind CSS and fonts are bundled locally. Installed desktop builds do not need a CDN to render the interface. User-provided remote image URLs still need their origin to be available.
- Category templates in the card editor add missing suggested attributes and a starting outline without overwriting written content.

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
- Node.js (v22.12 or higher)
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

## Validation

```bash
npm run build
npm run lint
npm test
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Browser tests use installed Microsoft Edge and an isolated in-memory Tauri bridge; they do not open or write personal workspace files. Rust storage tests use temporary directories and verify image/metadata round trips, backup recovery, and path validation.

Quality contracts, review stages, CI validation and desktop smoke instructions: [Quality](docs/QUALITY.md). Production measurements and repeatable fixture: [Canvas benchmark](docs/BENCHMARK.md).
