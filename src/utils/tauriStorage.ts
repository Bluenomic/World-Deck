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

/**
 * Window Controls IPC Helpers
 */
export const minimizeTauriWindow = async (): Promise<void> => {
  if (!isTauriAvailable()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('window_minimize');
  } catch (error) {
    console.error('Tauri window_minimize failed, trying JS API:', error);
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error('JS minimize failed:', e);
    }
  }
};

export const toggleMaximizeTauriWindow = async (): Promise<boolean> => {
  if (!isTauriAvailable()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const isMax = await invoke<boolean>('window_toggle_maximize');
    return isMax;
  } catch (error) {
    console.error('Tauri window_toggle_maximize failed, trying JS API:', error);
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.toggleMaximize();
      return await win.isMaximized();
    } catch (e) {
      console.error('JS toggleMaximize failed:', e);
      return false;
    }
  }
};

export const closeTauriWindow = async (): Promise<void> => {
  if (!isTauriAvailable()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('window_close');
  } catch (error) {
    console.error('Tauri window_close failed, trying JS API:', error);
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (e) {
      console.error('JS close failed:', e);
    }
  }
};

export const startDraggingTauriWindow = async (): Promise<void> => {
  if (!isTauriAvailable()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('window_start_dragging');
  } catch (error) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch (e) {
      // silent
    }
  }
};

export const isTauriWindowMaximized = async (): Promise<boolean> => {
  if (!isTauriAvailable()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('window_is_maximized');
  } catch (error) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      return await getCurrentWindow().isMaximized();
    } catch (e) {
      return false;
    }
  }
};

/**
 * Save project directly to user-selected folder path on disk via Tauri
 */
export const saveProjectToFolder = async (folderPath: string, project: WorldProject): Promise<string | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('save_project_to_folder', { folderPath, project });
  } catch (error) {
    console.error('Tauri save_project_to_folder failed:', error);
    return null;
  }
};

/**
 * List all project JSON files inside user-selected folder path via Tauri
 */
export const listProjectsInFolder = async (folderPath: string): Promise<WorldProject[]> => {
  if (!isTauriAvailable()) return [];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return (await invoke<WorldProject[]>('list_projects_in_folder', { folderPath })) || [];
  } catch (error) {
    console.error('Tauri list_projects_in_folder failed:', error);
    return [];
  }
};

/**
 * Delete a project JSON file inside user-selected folder path by ID via Tauri
 */
export const deleteProjectFromFolder = async (folderPath: string, id: string): Promise<boolean> => {
  if (!isTauriAvailable()) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_project_from_folder', { folderPath, id });
    return true;
  } catch (error) {
    console.error('Tauri delete_project_from_folder failed:', error);
    return false;
  }
};

/**
 * Opens native OS folder selection dialog via Rust rfd backend
 */
export const openWorkspaceFolderDialog = async (): Promise<string | null> => {
  if (!isTauriAvailable()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string | null>('select_workspace_folder_dialog');
  } catch (error) {
    console.error('Tauri select_workspace_folder_dialog failed:', error);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Pilih Folder Workspace Proyek',
      });
      return typeof selected === 'string' ? selected : null;
    } catch (e) {
      console.error('Tauri plugin-dialog failed:', e);
      return null;
    }
  }
};

