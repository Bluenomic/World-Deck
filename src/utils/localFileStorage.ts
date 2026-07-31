import type { WorldProject } from '../types';

/**
 * Reads all .json files in the given directory handle and parses them as WorldProject
 */
export const readAllProjectsFromDirectory = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<WorldProject[]> => {
  const projects: WorldProject[] = [];
  try {
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (parsed && Array.isArray(parsed.cards)) {
            projects.push(parsed);
          }
        } catch (e) {
          console.warn(`Gagal membaca berkas ${entry.name}:`, e);
        }
      }
    }
  } catch (err) {
    console.error('Gagal membaca direktori:', err);
  }
  return projects;
};

/**
 * Writes a project to a file inside the directory handle
 */
export const writeProjectToDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  project: WorldProject
): Promise<boolean> => {
  try {
    const filename = `project_${project.id}.json`;
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    const content = JSON.stringify(project, null, 2);
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    console.error('Gagal menulis berkas ke direktori:', err);
    return false;
  }
};

/**
 * Deletes a project file from the directory handle
 */
export const deleteProjectFromDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  projectId: string
): Promise<boolean> => {
  const filename = `project_${projectId}.json`;
  try {
    await dirHandle.removeEntry(filename);
    return true;
  } catch (err) {
    console.warn(`Gagal menghapus berkas ${filename} dari direktori:`, err);
    return false;
  }
};
