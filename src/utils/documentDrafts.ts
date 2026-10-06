import type { WorldDocument } from "../types";
export interface DraftIdentity {
  workspaceId: string;
  projectId: string;
  documentId: string;
}
export const draftKey = (identity: DraftIdentity) =>
  `worlddeck_draft_v2:${JSON.stringify([identity.workspaceId, identity.projectId, identity.documentId])}`;
export type DraftWriter = (
  document: WorldDocument,
  transactionId: string,
) => Promise<unknown>;
const same = (a: WorldDocument, b: WorldDocument) =>
  a.title === b.title && a.content === b.content;
export function readDocumentBackup(
  identity: DraftIdentity,
  base: WorldDocument,
  storage: Storage = localStorage,
): WorldDocument | undefined {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(draftKey(identity)) || "null",
    );
    if (!value || typeof value !== "object") return;
    const doc = value as WorldDocument;
    if (
      doc.id === identity.documentId &&
      typeof doc.title === "string" &&
      typeof doc.content === "string" &&
      Number.isFinite(doc.updatedAt) &&
      doc.updatedAt > base.updatedAt
    )
      return {
        ...base,
        title: doc.title,
        content: doc.content,
        updatedAt: doc.updatedAt,
      };
  } catch {
    /* Invalid backups never replace the project. */
  }
}
export class DocumentDraftSession {
  readonly transactionId = `document:${crypto.randomUUID()}`;
  private latest: WorldDocument;
  private saved: WorldDocument;
  private timer?: ReturnType<typeof setTimeout>;
  private flight: Promise<boolean> = Promise.resolve(true);
  backupFailed = false;
  readonly identity: DraftIdentity;
  private read: () => WorldDocument;
  private persist: DraftWriter;
  private storage: Storage;
  constructor(
    identity: DraftIdentity,
    base: WorldDocument,
    read: () => WorldDocument,
    persist: DraftWriter,
    storage: Storage = localStorage,
  ) {
    this.identity = identity;
    this.read = read;
    this.persist = persist;
    this.storage = storage;
    this.saved = base;
    this.latest = readDocumentBackup(identity, base, storage) || base;
  }
  get snapshot() {
    return this.latest;
  }
  freeze() {
    const snapshot = this.capture();
    this.read = () => snapshot;
  }
  capture() {
    const value = this.read();
    if (!same(value, this.latest))
      this.latest = {
        ...value,
        updatedAt: Math.max(Date.now(), this.latest.updatedAt + 1),
      };
    return this.latest;
  }
  get dirty() {
    return !same(this.capture(), this.saved);
  }
  changed() {
    this.capture();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.commit();
    }, 750);
  }
  backup() {
    const snapshot = this.capture();
    if (same(snapshot, this.saved)) return;
    try {
      this.storage.setItem(draftKey(this.identity), JSON.stringify(snapshot));
      this.backupFailed = false;
    } catch {
      this.backupFailed = true;
    }
  }
  commit(): Promise<boolean> {
    clearTimeout(this.timer);
    this.backup();
    this.flight = this.flight
      .catch(() => false)
      .then(async () => {
        const snapshot = this.capture();
        if (same(snapshot, this.saved)) return true;
        this.backup();
        try {
          await this.persist(snapshot, this.transactionId);
          this.saved = snapshot;
          const raw = this.storage.getItem(draftKey(this.identity));
          if (
            raw &&
            (JSON.parse(raw) as WorldDocument).updatedAt ===
              snapshot.updatedAt &&
            same(JSON.parse(raw) as WorldDocument, snapshot) &&
            same(this.capture(), snapshot)
          )
            this.storage.removeItem(draftKey(this.identity));
          return true;
        } catch {
          return false;
        }
      });
    return this.flight;
  }
  dispose() {
    clearTimeout(this.timer);
    this.backup();
  }
}
class DocumentDraftRegistry {
  private sessions = new Map<DocumentDraftSession, () => void>();
  register(session: DocumentDraftSession, onFinish: () => void = () => {}) {
    this.sessions.set(session, onFinish);
    return () => {
      session.dispose();
      this.sessions.delete(session);
    };
  }
  get dirty() {
    return [...this.sessions.keys()].some((session) => session.dirty);
  }
  backupAll() {
    for (const session of this.sessions.keys()) session.backup();
  }
  async finish() {
    if (!(await this.flush())) return false;
    for (const finish of this.sessions.values()) finish();
    return true;
  }
  async flush() {
    return (
      await Promise.all(
        [...this.sessions.keys()].map((session) => session.commit()),
      )
    ).every(Boolean);
  }
}
export const documentDrafts = new DocumentDraftRegistry();
