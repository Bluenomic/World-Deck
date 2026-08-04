import type { WorldProject, WorldCard } from '../types';

/**
 * Helper to detect if running inside Tauri desktop app environment
 */
export const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

/**
 * Save a WorldProject to local disk via Rust Tauri backend
 */
export const saveWorldToDisk = async (project: WorldProject): Promise<string | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('save_world_project', { project });
    return path;
  } catch (error) {
    console.error('Tauri save_world_project failed:', error);
    return null;
  }
};

/**
 * Load a WorldProject from local disk by ID via Rust Tauri backend
 */
export const loadWorldFromDisk = async (id: string): Promise<WorldProject | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const project = await invoke<WorldProject>('load_world_project', { id });
    return project;
  } catch (error) {
    console.error('Tauri load_world_project failed:', error);
    return null;
  }
};

/**
 * List all saved WorldProjects on disk via Rust Tauri backend
 */
export const listWorldsFromDisk = async (): Promise<WorldProject[]> => {
  if (!isTauriAvailable()) return [];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const projects = await invoke<WorldProject[]>('list_world_projects');
    return projects || [];
  } catch (error) {
    console.error('Tauri list_world_projects failed:', error);
    return [];
  }
};

/**
 * Delete a WorldProject from disk by ID via Rust Tauri backend
 */
export const deleteWorldFromDisk = async (id: string): Promise<boolean> => {
  if (!isTauriAvailable()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_world_project', { id });
    return true;
  } catch (error) {
    console.error('Tauri delete_world_project failed:', error);
    return false;
  }
};

/**
 * Export a WorldProject to a custom file path on disk via Rust Tauri backend
 */
export const exportWorldToFile = async (filePath: string, project: WorldProject): Promise<boolean> => {
  if (!isTauriAvailable()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('export_world_project', { filePath, project });
    return true;
  } catch (error) {
    console.error('Tauri export_world_project failed:', error);
    return false;
  }
};

/**
 * Import a WorldProject from a custom file path on disk via Rust Tauri backend
 */
export const importWorldFromFile = async (filePath: string): Promise<WorldProject | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const project = await invoke<WorldProject>('import_world_project', { filePath });
    return project;
  } catch (error) {
    console.error('Tauri import_world_project failed:', error);
    return null;
  }
};

/**
 * Save image data (Base64 data URL or file path) to local app assets folder via Rust backend,
 * returning a webview-friendly asset URL (convertFileSrc).
 */
export const saveImageAsset = async (imageData: string, filenameHint?: string): Promise<string | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const rawPath = await invoke<string>('save_image_asset', { imageData, filenameHint });
    if (rawPath) {
      return convertFileSrc(rawPath);
    }
    return null;
  } catch (error) {
    console.error('Tauri save_image_asset failed:', error);
    return null;
  }
};

/**
 * Open native OS save file dialog
 */
export const pickNativeSaveFilePath = async (defaultName: string): Promise<string | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: 'WorldDeck Archive', extensions: ['json', 'worlddeck'] }],
    });
    return path;
  } catch (error) {
    console.error('Tauri save dialog failed:', error);
    return null;
  }
};

/**
 * Open native OS open file dialog
 */
export const pickNativeOpenFilePath = async (): Promise<string | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({
      multiple: false,
      filters: [{ name: 'WorldDeck Archive', extensions: ['json', 'worlddeck'] }],
    });
    return path ? (Array.isArray(path) ? path[0] : path) : null;
  } catch (error) {
    console.error('Tauri open dialog failed:', error);
    return null;
  }
};

/**
 * Perform high-performance card search using Rust backend
 */
export const searchCardsViaRust = async (
  cards: WorldCard[],
  query: string,
  category?: string
): Promise<WorldCard[]> => {
  if (!isTauriAvailable()) return cards;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const filtered = await invoke<WorldCard[]>('search_world_cards', { cards, query, category });
    return filtered || [];
  } catch (error) {
    console.error('Tauri search_world_cards failed:', error);
    return cards;
  }
};
