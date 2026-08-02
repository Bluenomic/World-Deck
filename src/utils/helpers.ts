import type { WorldCard } from '../types';

export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
};

/**
 * Calculates a smooth cubic bezier path string for SVG connection line
 */
export const getBezierPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): { path: string; midX: number; midY: number } => {
  let controlX1 = x1;
  let controlY1 = y1;
  let controlX2 = x2;
  let controlY2 = y2;

  if (direction === 'vertical') {
    const dy = Math.max(Math.abs(y2 - y1) * 0.45, 30);
    controlX1 = x1;
    controlY1 = y1 < y2 ? y1 + dy : y1 - dy;
    controlX2 = x2;
    controlY2 = y1 < y2 ? y2 - dy : y2 + dy;
  } else {
    const dx = Math.max(Math.abs(x2 - x1) * 0.45, 30);
    controlY1 = y1;
    controlX1 = x1 < x2 ? x1 + dx : x1 - dx;
    controlY2 = y2;
    controlX2 = x1 < x2 ? x2 - dx : x2 + dx;
  }

  const path = `M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`;

  // Midpoint calculation for relation label positioning
  const t = 0.5;
  const midX = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * controlX1 + 3 * (1 - t) * t ** 2 * controlX2 + t ** 3 * x2;
  const midY = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * controlY1 + 3 * (1 - t) * t ** 2 * controlY2 + t ** 3 * y2;

  return { path, midX, midY };
};

/**
 * Parses @mentions in text (e.g., @card-01 or @Eldrin) and returns structured segments
 */
export interface TextSegment {
  text: string;
  cardId?: string;
  cardTitle?: string;
  isMention: boolean;
}

export const parseMentions = (content: string, cards: WorldCard[]): TextSegment[] => {
  if (!content) return [];

  // Match @card-id or @[Title] or @Word
  const mentionRegex = /@([a-zA-Z0-9_-]+|\[[^\]]+\])/g;
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const rawMention = match[0];
    const mentionKey = match[1].replace(/^\[|\]$/g, '');

    // Add preceding text
    if (startIndex > lastIndex) {
      segments.push({
        text: content.substring(lastIndex, startIndex),
        isMention: false,
      });
    }

    // Find target card
    const targetCard = cards.find(
      (c) => c.id === mentionKey || c.title.toLowerCase() === mentionKey.toLowerCase()
    );

    if (targetCard) {
      segments.push({
        text: `@${targetCard.title}`,
        cardId: targetCard.id,
        cardTitle: targetCard.title,
        isMention: true,
      });
    } else {
      segments.push({
        text: rawMention,
        isMention: false,
      });
    }

    lastIndex = mentionRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({
      text: content.substring(lastIndex),
      isMention: false,
    });
  }

  return segments;
};

/**
 * Save project to JSON file download
 */
export const downloadProjectJson = (projectData: any) => {
  const jsonStr = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-world.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
