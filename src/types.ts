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
  imageHeight?: number;
  images?: string[];
  tags: string[];
  attributes: CustomAttribute[];
  x: number;
  y: number;
  width?: number;
  height?: number;
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

export type DocumentCategory = 
  | 'story'
  | 'note'
  | 'chapter'
  | 'world_guide'
  | 'character_log';

export interface WorldDocument {
  id: string;
  title: string;
  content: string;
  category: DocumentCategory;
  summary?: string;
  tags?: string[];
  associatedCardIds?: string[];
  createdAt: number;
  updatedAt: number;
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
  documents?: WorldDocument[];
  createdAt: number;
  updatedAt: number;
}

export interface TimelineBranch {
  id: string;
  sourceTrackId: string;
  sourceX: number;
  sourceNodeId?: string;
  targetTrackId: string;
  targetX: number;
  targetNodeId?: string;
  label?: string;
}

export type ViewMode = 'canvas' | 'library' | 'timeline' | 'documents';

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

export interface TimelineTrack {
  id: string;
  name: string;
  y: number;
  direction: 'right' | 'left';
  color: string;
  isMain?: boolean;
}

export interface TimelineNode {
  id: string;
  trackId: string;
  x: number;
  title: string;
  dateLabel: string;
  description?: string;
  cardId?: string;
  nodeType: 'event' | 'branch' | 'joint' | 'loop' | 'point';
  color?: string;
}

export interface TimelineLink {
  id: string;
  type: 'flow' | 'branch' | 'joint' | 'loop' | 'reverse';
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
}
