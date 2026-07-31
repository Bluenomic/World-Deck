# World Deck

World Deck is an interactive canvas-based worldbuilding application. Designed for writers, game designers, and world builders who want to visually map and connect elements of their fictional worlds -- from characters, factions, locations, and items to key events.

## Features

### Interactive Canvas
- Drag-and-drop cards on a free-form canvas with smooth pan and zoom
- Cursor-centric focal zoom (zooms toward the mouse pointer position)
- Hold Spacebar + drag to navigate the canvas
- Box selection to select multiple cards at once
- Double-click on empty canvas area to create a new card at that position

### World Cards
- 7 categories: Character, Faction, Location, Lore, Timeline, Item, and Realm
- Each card supports a title, subtitle, summary, full content, cover image, tags, and custom attributes
- Cross-reference other cards using `@CardName` within content

### Relations and Connections
- Connect cards by dragging connection handles from card edges
- Customizable relation labels (ally, enemy, leader, member, etc.)
- Bezier curve lines with arrowheads and midpoint labels
- Per-theme high-contrast line colors

### Multi-Workspace
- Create, duplicate, and manage multiple separate worlds within one app
- Export and import worlds as JSON files
- Auto-save to IndexedDB with LocalStorage fallback

### View Modes
- **Canvas**: Primary visual map with cards and connection lines
- **Library**: Grid/list view of all cards
- **Timeline**: Chronological event view
- **Relations**: Full list of all connections between cards

### Auto-Layout
- 4 layout modes for selected cards: Grid, Horizontal, Vertical, and Radial
- Only operates on cards selected via box selection (minimum 2 cards)

### Undo / Redo
- History stack up to 50 steps
- Keyboard shortcuts: `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo)

### Card Deletion
- Delete one or multiple cards at once with `Delete` / `Backspace`
- Custom confirmation modal listing all cards to be removed
- All related connections are automatically cleaned up

### Themes
- 5 visual themes: Notion Dark, Notion Light, Cyberpunk, Dracula, and Nordic Slate
- Connection line contrast and UI elements adapt per theme

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS** (styling)
- **Lucide React** (icon library)
- **IndexedDB** + **LocalStorage** (client-side persistence)
- **Canvas Confetti** (visual effects)

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
  App.tsx                  # Root component and state management
  types.ts                 # Type definitions (WorldCard, CardConnection, etc.)
  index.css                # Global styles and theme variables
  main.tsx                 # Entry point
  components/
    Canvas.tsx             # Interactive canvas (pan, zoom, box selection, auto-layout)
    WorldCardNode.tsx      # Individual card node on canvas
    CardEditorModal.tsx    # Card editor modal
    ConnectionModal.tsx    # Connection/relation editor modal
    DeleteCardModal.tsx    # Card deletion confirmation modal
    Navbar.tsx             # Main navigation and project controls
    SidebarFilter.tsx      # Category filter sidebar and search
    LibraryView.tsx        # Library grid view
    TimelineView.tsx       # Timeline view
    RelationListView.tsx   # Relation list view
    WorldManagerModal.tsx  # Multi-workspace manager modal
    HelpGuideModal.tsx     # Usage guide modal
  data/
    sampleWorld.ts         # Default new world template
  utils/
    helpers.ts             # Utility functions (ID generator, bezier path, etc.)
    storage.ts             # IndexedDB + LocalStorage persistence engine
    localFileStorage.ts    # File System Access API utilities
```

## Native App Build (Optional)

This project is compatible with [Tauri v2](https://v2.tauri.app/) for packaging as a desktop (.exe) or Android (.apk) application.

```bash
npx @tauri-apps/cli init
npx tauri build           # Desktop
npx tauri android build   # Android
```
