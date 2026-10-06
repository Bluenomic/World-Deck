import type { WorldProject } from '../types';
import { externalizeAssets, hydrateAssets } from './projectAssets';
import { validateProject, type WorkspaceLoadReport, type ProjectIssue } from './projectValidation';

/**
 * Reads all .json files in the given directory handle and parses them as WorldProject
 */
export const readWorkspaceFromDirectory = async (dirHandle: FileSystemDirectoryHandle): Promise<WorkspaceLoadReport> => {
  const report: WorkspaceLoadReport = { projects: [], issues: [], sources: [] };
  const filenames = new Set<string>();
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== 'file') continue;
    if (entry.name.endsWith('.json')) filenames.add(entry.name);
    if (entry.name.endsWith('.json.bak')) filenames.add(entry.name.slice(0, -4));
  }
  for (const name of filenames) {
    const read = async (filename: string) => {
      const handle = await dirHandle.getFileHandle(filename);
      const validated = validateProject(JSON.parse(await (await handle.getFile()).text()));
      if (!validated.project) throw Object.assign(new Error('Invalid project structure'), { issues: validated.issues });
      const issues: ProjectIssue[] = [...validated.issues];
      const project = await hydrateAssets(dirHandle, validated.project, asset => {
        issues.push({ code: 'missing_asset', path: asset, severity: 'warning', projectId: validated.project!.id });
      }) as WorldProject;
      return { project, issues };
    };
    let result: Awaited<ReturnType<typeof read>>; let source: 'primary' | 'backup' = 'primary';
    try { result = await read(name); }
    catch (error) {
      const invalidIssues = error instanceof Error && 'issues' in error && Array.isArray(error.issues) ? error.issues as ProjectIssue[] : [];
      report.issues.push(...invalidIssues.map(issue => ({...issue,fileName:name})));
      if (invalidIssues.some(issue => issue.code === 'unsupported_schema')) continue;
      try { result = await read(`${name}.bak`); source = 'backup'; }
      catch { report.issues.push({ code: 'unreadable_project', path: name, fileName: name, severity: 'error' }); continue; }
    }
    if (report.projects.some(p => p.id === result.project.id)) {
      report.issues.push({ code: 'duplicate_id', path: name, fileName: name, severity: 'error', projectId: result.project.id }); continue;
    }
    report.projects.push(result.project);
    report.sources.push({ projectId: result.project.id, fileName: name, source });
    report.issues.push(...result.issues.map(issue => ({ ...issue, fileName: name })));
    if (source === 'backup') report.issues.push({ code:'backup_recovered', path:name, fileName:name, severity:'warning', projectId:result.project.id });
  }
  report.projects.sort((a,b) => b.updatedAt - a.updatedAt);
  return report;
};
export const readAllProjectsFromDirectory = async (directory: FileSystemDirectoryHandle): Promise<WorldProject[]> => (await readWorkspaceFromDirectory(directory)).projects;

/**
 * Writes a project to a file inside the directory handle
 */
export const writeProjectToDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  project: WorldProject
): Promise<boolean> => {
  try {
    const validated = validateProject(project);
    if (!validated.project) throw new Error('Invalid project');
    project = validated.project;
    const filename = `project_${project.id}.json`;
    if (!/^[a-zA-Z0-9_-]+$/.test(project.id)) throw new Error('Invalid project ID');
    const content = JSON.stringify(await externalizeAssets(dirHandle, project), null, 2);
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const old = await (await fileHandle.getFile()).text();
    let valid = false;
    try { valid = !!validateProject(JSON.parse(old)).project; } catch { /* Empty or damaged primary. */ }
    if (valid) {
      const backup = await dirHandle.getFileHandle(`${filename}.bak`, { create: true });
      const writer = await backup.createWritable(); await writer.write(old); await writer.close();
    }
    const writable = await fileHandle.createWritable();
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
  try {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('Invalid project ID');
    const filename = `project_${projectId}.json`;
    try { await dirHandle.removeEntry(filename); } catch (e) {
      if (!(e instanceof DOMException) || e.name !== 'NotFoundError') throw e;
    }
    try { await dirHandle.removeEntry(`${filename}.bak`); } catch (e) {
      if (!(e instanceof DOMException) || e.name !== 'NotFoundError') throw e;
    }
    return true;
  } catch (err) {
    console.warn(`Gagal menghapus proyek ${projectId} dari direktori:`, err);
    return false;
  }
};
