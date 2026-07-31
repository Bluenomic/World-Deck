import type { WorldProject } from '../types';
import { downloadProjectJson } from './helpers';

let activeFileHandle: any = null;

export const getActiveFileHandle = () => activeFileHandle;

/**
 * Checks if File System Access API is supported by the browser / desktop webview
 */
export const isFileSystemAccessSupported = (): boolean => {
  return 'showSaveFilePicker' in window || 'showOpenFilePicker' in window;
};

/**
 * Fallback file picker using standard HTML file input
 */
export const triggerFallbackFileInput = (): Promise<{ text: string; fileName: string } | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        try {
          const text = await file.text();
          resolve({ text, fileName: file.name });
        } catch (err) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    input.click();
  });
};

/**
 * Prompts user to pick/create a local .json file on their hard drive for auto-syncing
 */
export const connectLocalFileOnDisk = async (
  project: WorldProject
): Promise<{ fileHandle: any; fileName: string } | null> => {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-world.json`,
        types: [
          {
            description: 'Berkas Worldbuilding JSON',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });

      activeFileHandle = handle;
      await writeToLocalFileHandle(handle, project);
      return { fileHandle: handle, fileName: handle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      console.warn('File System Access API error, using direct file save fallback:', err);
    }
  }

  // Fallback: Direct File Save to Hard Drive
  const defaultFileName = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-world.json`;
  downloadProjectJson(project);
  return { fileHandle: null, fileName: defaultFileName };
};

/**
 * Prompts user to open an existing local .json file from hard drive to link and auto-save
 */
export const openLocalFileFromDisk = async (): Promise<{ project: WorldProject; fileHandle: any; fileName: string } | null> => {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Berkas Worldbuilding JSON',
            accept: { 'application/json': ['.json'] },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed && Array.isArray(parsed.cards)) {
        activeFileHandle = handle;
        return { project: parsed, fileHandle: handle, fileName: handle.name };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      console.warn('File System Access API error, using standard file input fallback:', err);
    }
  }

  // Fallback: Native HTML File Input
  const fallback = await triggerFallbackFileInput();
  if (fallback) {
    try {
      const parsed = JSON.parse(fallback.text);
      if (parsed && Array.isArray(parsed.cards)) {
        return { project: parsed, fileHandle: null, fileName: fallback.fileName };
      }
    } catch (err) {
      alert('Format berkas JSON tidak valid.');
    }
  }

  return null;
};

/**
 * Writes data directly to the given local file handle on hard drive
 */
export const writeToLocalFileHandle = async (handle: any, project: WorldProject): Promise<boolean> => {
  const targetHandle = handle || activeFileHandle;
  if (!targetHandle) return false;
  try {
    const writable = await targetHandle.createWritable();
    const content = JSON.stringify(project, null, 2);
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Gagal menulis berkas ke disk lokal:', err);
    return false;
  }
};
