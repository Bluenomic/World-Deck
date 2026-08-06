import type { CardCategory, CategoryConfig } from '../types';

export const PRIMARY_CATEGORIES: CardCategory[] = ['character', 'faction', 'location', 'lore', 'item'];

export const CATEGORY_CONFIGS: Record<CardCategory, CategoryConfig> = {
  character: {
    id: 'character',
    label: 'Karakter & Tokoh',
    iconName: 'User',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
  faction: {
    id: 'faction',
    label: 'Faksi & Kelompok',
    iconName: 'Shield',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
  location: {
    id: 'location',
    label: 'Lokasi & Wilayah',
    iconName: 'MapPin',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
  lore: {
    id: 'lore',
    label: 'Lore & Timeline',
    iconName: 'BookOpen',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
  item: {
    id: 'item',
    label: 'Item & Artefak',
    iconName: 'Sparkles',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
  timeline: {
    id: 'lore',
    label: 'Lore & Timeline',
    iconName: 'BookOpen',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
  realm: {
    id: 'location',
    label: 'Lokasi & Wilayah',
    iconName: 'MapPin',
    color: 'var(--text-primary)',
    bgGradient: 'app-bg-secondary',
    borderColor: 'app-border',
    glowColor: '',
  },
};
