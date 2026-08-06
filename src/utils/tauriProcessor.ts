import type { WorldProject, WorldCard } from '../types';
import { isTauriAvailable } from './tauriStorage';
import { getBezierPath as getBezierPathJS, parseMentions as parseMentionsJS, type TextSegment } from './helpers';

export interface BezierResult {
  path: string;
  midX: number;
  midY: number;
}

export interface CategoryStat {
  category: string;
  count: number;
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface CardConnectionStat {
  cardId: string;
  cardTitle: string;
  connectionCount: number;
}

export interface ProjectStats {
  totalCards: number;
  totalConnections: number;
  totalDocuments: number;
  totalCanvases: number;
  categoryCounts: CategoryStat[];
  topTags: TagStat[];
  mostConnectedCards: CardConnectionStat[];
  orphanCardIds: string[];
}

/**
  Computes Bezier SVG curve and midpoint via Rust (with JS fallback)
 */
export const computeBezierPathRust = async (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): Promise<BezierResult> => {
  if (isTauriAvailable()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<BezierResult>('compute_bezier_path', { x1, y1, x2, y2, direction });
    } catch (e) {
      console.warn('Rust compute_bezier_path failed, using JS fallback:', e);
    }
  }
  return getBezierPathJS(x1, y1, x2, y2, direction);
};

/**
  Parses @mentions in content text via Rust (with JS fallback)
 */
export const parseMentionsRust = async (
  content: string,
  cards: WorldCard[]
): Promise<TextSegment[]> => {
  if (isTauriAvailable()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<TextSegment[]>('parse_mentions', { content, cards });
    } catch (e) {
      console.warn('Rust parse_mentions failed, using JS fallback:', e);
    }
  }
  return parseMentionsJS(content, cards);
};

/**
  Sanitizes and cleans up project integrity via Rust
 */
export const sanitizeProjectRust = async (project: WorldProject): Promise<WorldProject> => {
  if (isTauriAvailable()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<WorldProject>('sanitize_project', { project });
    } catch (e) {
      console.warn('Rust sanitize_project failed:', e);
    }
  }
  return project;
};

/**
  Computes detailed workspace analytics via Rust
 */
export const computeProjectStatsRust = async (project: WorldProject): Promise<ProjectStats | null> => {
  if (isTauriAvailable()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<ProjectStats>('compute_project_stats', { project });
    } catch (e) {
      console.warn('Rust compute_project_stats failed:', e);
    }
  }
  return null;
};

/**
  Exports world project to Markdown string via Rust
 */
export const exportProjectToMarkdownRust = async (project: WorldProject): Promise<string | null> => {
  if (isTauriAvailable()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('export_project_to_markdown', { project });
    } catch (e) {
      console.warn('Rust export_project_to_markdown failed:', e);
    }
  }
  return null;
};
