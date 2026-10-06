import type { WorldProject } from "../types";
import { validateProject, type WorkspaceLoadReport } from "./projectValidation";
import { enqueueSave } from "./saveQueue";
import {
  readWorkspaceFromDirectory,
  writeProjectToDirectory,
  deleteProjectFromDirectory,
} from "./localFileStorage";

export interface WorkspaceAdapter {
  readonly id: string;
  load(): Promise<WorkspaceLoadReport>;
  save(project: WorldProject): Promise<void>;
  delete(projectId: string): Promise<void>;
}
export interface SaveAcknowledgement {
  workspaceId: string;
  projectId: string;
  revision: number;
}
export interface WorkspaceFailure extends SaveAcknowledgement {
  operation: "save" | "delete";
  message: string;
  code: "write_failed" | "delete_failed";
}
export class WorkspaceOperationError extends Error {
  readonly failure: WorkspaceFailure;
  constructor(failure: WorkspaceFailure) {
    super(failure.message);
    this.name = "WorkspaceOperationError";
    this.failure = failure;
  }
}
interface Job extends SaveAcknowledgement {
  adapter: WorkspaceAdapter;
  operation: "save" | "delete";
  project?: WorldProject;
  onSuccess?: () => void;
  failure?: WorkspaceFailure;
}
const browserIds = new WeakMap<FileSystemDirectoryHandle, string>();
export function browserWorkspace(
  directory: FileSystemDirectoryHandle,
  identity?: string,
): WorkspaceAdapter {
  let id = identity || browserIds.get(directory);
  if (!id) {
    id = `browser:${crypto.randomUUID()}`;
    browserIds.set(directory, id);
  }
  return {
    id,
    load: () => readWorkspaceFromDirectory(directory),
    async save(project) {
      if (!(await writeProjectToDirectory(directory, project)))
        throw new Error("Workspace write failed");
    },
    async delete(projectId) {
      if (!(await deleteProjectFromDirectory(directory, projectId)))
        throw new Error("Workspace delete failed");
    },
  };
}
export function nativeWorkspace(folderPath: string): WorkspaceAdapter {
  const invoke = async <T>(command: string, args: Record<string, unknown>) => {
    const { invoke: call } = await import("@tauri-apps/api/core");
    return call<T>(command, args);
  };
  return {
    id: `native:${folderPath.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase()}`,
    async load() {
      const raw = await invoke<WorkspaceLoadReport>("read_workspace", {
        folderPath,
      });
      if (!raw || !Array.isArray(raw.projects))
        throw new Error("Invalid workspace report");
      const report: WorkspaceLoadReport = {
        projects: [],
        issues: [...raw.issues],
        sources: raw.sources,
      };
      for (const project of raw.projects) {
        const result = validateProject(project);
        report.issues.push(...result.issues);
        if (result.project) report.projects.push(result.project);
      }
      return report;
    },
    async save(project) {
      const validated = validateProject(project);
      if (!validated.project) throw new Error("Invalid project structure");
      await invoke("save_project_to_folder", {
        folderPath,
        project: validated.project,
      });
    },
    async delete(projectId) {
      await invoke("delete_project_from_folder", { folderPath, id: projectId });
    },
  };
}

/** One coordinator owns all captured workspace targets, including inactive ones. */
export class WorkspacePersistence {
  private revisions = new Map<string, number>();
  private failed = new Map<string, Job>();
  private latest = new Map<string, Job>();
  private deleting = new Set<string>();
  private deleted = new Set<string>();
  private pending = new Set<Promise<SaveAcknowledgement>>();
  private listeners = new Set<() => void>();
  private acknowledgements = new Map<string, number>();
  private key(workspaceId: string, projectId: string) {
    return JSON.stringify([workspaceId, projectId]);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    for (const listener of this.listeners) listener();
  }
  get pendingCount() {
    return this.pending.size;
  }
  get failures(): WorkspaceFailure[] {
    return [...this.failed.values()].map((j) => ({
      workspaceId: j.workspaceId,
      projectId: j.projectId,
      revision: j.revision,
      operation: j.operation,
      message: j.failure?.message || "Workspace operation failed",
      code: j.operation === "save" ? "write_failed" : "delete_failed",
    }));
  }
  isDeleting(workspaceId: string, projectId: string) {
    const key = this.key(workspaceId, projectId);
    return this.deleting.has(key) || this.deleted.has(key);
  }
  savedRevision(workspaceId: string, projectId: string) {
    return this.acknowledgements.get(this.key(workspaceId, projectId)) || 0;
  }
  private make(
    adapter: WorkspaceAdapter,
    projectId: string,
    operation: Job["operation"],
    project?: WorldProject,
    onSuccess?: () => void,
  ): Job {
    const key = this.key(adapter.id, projectId);
    const revision = (this.revisions.get(key) || 0) + 1;
    this.revisions.set(key, revision);
    const job = {
      adapter,
      workspaceId: adapter.id,
      projectId,
      revision,
      operation,
      project,
      onSuccess,
    };
    this.latest.set(key, job);
    return job;
  }
  save(
    adapter: WorkspaceAdapter,
    project: WorldProject,
  ): Promise<SaveAcknowledgement> {
    if (this.isDeleting(adapter.id, project.id))
      return Promise.reject(new Error("Project is being deleted"));
    return this.run(this.make(adapter, project.id, "save", project));
  }
  delete(
    adapter: WorkspaceAdapter,
    projectId: string,
    onSuccess?: () => void,
  ): Promise<SaveAcknowledgement> {
    const key = this.key(adapter.id, projectId);
    if (this.isDeleting(adapter.id, projectId))
      return Promise.reject(new Error("Project is being deleted"));
    this.deleting.add(key);
    return this.run(
      this.make(adapter, projectId, "delete", undefined, onSuccess),
    );
  }
  private run(job: Job): Promise<SaveAcknowledgement> {
    const key = this.key(job.workspaceId, job.projectId);
    const promise = enqueueSave(job.workspaceId, async () => {
      try {
        if (job.operation === "save") await job.adapter.save(job.project!);
        else {
          await job.adapter.delete(job.projectId);
          this.deleted.add(key);
        }
        this.acknowledgements.set(key, job.revision);
        const failure = this.failed.get(key);
        if (!failure || failure.revision <= job.revision)
          this.failed.delete(key);
        job.onSuccess?.();
        return {
          workspaceId: job.workspaceId,
          projectId: job.projectId,
          revision: job.revision,
        };
      } catch (error) {
        // Retain the latest intended state, rather than retrying an obsolete snapshot.
        const intended = this.latest.get(key) || job;
        const failure: WorkspaceFailure = {
          workspaceId: intended.workspaceId,
          projectId: intended.projectId,
          revision: intended.revision,
          operation: intended.operation,
          code:
            intended.operation === "save" ? "write_failed" : "delete_failed",
          message:
            error instanceof Error
              ? error.message
              : typeof error === "string"
                ? error
                : "Workspace operation failed",
        };
        this.failed.set(key, { ...intended, failure });
        throw new WorkspaceOperationError(failure);
      } finally {
        if (job.operation === "delete" && this.deleted.has(key))
          this.deleting.delete(key);
      }
    });
    this.pending.add(promise);
    this.notify();
    void promise
      .finally(() => {
        this.pending.delete(promise);
        this.notify();
      })
      .catch(() => {});
    return promise;
  }
  async retry(): Promise<boolean> {
    const jobs = [...this.failed.values()];
    for (const job of jobs)
      if (job.operation === "delete")
        this.deleting.add(this.key(job.workspaceId, job.projectId));
    await Promise.allSettled(jobs.map((job) => this.run(job)));
    return this.flush();
  }
  async flush(): Promise<boolean> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
    return this.failed.size === 0;
  }
}
