export type CardCategory = 
  | 'character'
  | 'faction'
  | 'location'
  | 'lore'
  | 'timeline'
  | 'item'
  | 'realm';

export interface CustomAttribute {
  id: string;
  key: string;
  value: string;
}

export interface WorldCanvas {
  id: string;
  name: string;
  createdAt: number;
}

export interface WorldDeck {
  id: string;
  name: string;
  description?: string;
  color?: string;
  cardIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldCard {
  id: string;
  title: string;
  subtitle?: string;
  category: CardCategory;
  summary: string;
  content: string;
  imageUrl?: string;
  tags: string[];
  attributes: CustomAttribute[];
  x: number;
  y: number;
  pinned?: boolean;
  canvasId?: string;
  deckId?: string;
  createdAt: number;
  updatedAt: number;
}

export type RelationType = 
  | 'ally'
  | 'enemy'
  | 'member'
  | 'leader'
  | 'located_in'
  | 'creator'
  | 'owner'
  | 'caused_by'
  | 'involved_in'
  | 'custom';

export type ConnectionDirection = 'directed' | 'bidirectional' | 'undirected';

export interface CardConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  type?: RelationType;
  direction?: ConnectionDirection;
  description?: string;
}

export interface WorldProject {
  id: string;
  name: string;
  description: string;
  author?: string;
  version: string;
  cards: WorldCard[];
  connections: CardConnection[];
  canvases?: WorldCanvas[];
  decks?: WorldDeck[];
  createdAt: number;
  updatedAt: number;
}

export type ViewMode = 'canvas' | 'library' | 'timeline' | 'relations';

export type AppTheme = 'dark' | 'light';

export interface CategoryConfig {
  id: CardCategory;
  label: string;
  iconName: string;
  color: string; // Tailwind color name or hex
  bgGradient: string;
  borderColor: string;
  glowColor: string;
}

export interface CanvasViewport {
  zoom: number;
  pan: { x: number; y: number };
}

export interface WorkspacePreferences {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  categoriesHeight: number;
  canvasesHeight: number;
  viewMode?: ViewMode;
  canvasViewports?: Record<string, CanvasViewport>;
}
