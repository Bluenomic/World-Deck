import { useEffect, useRef, useState } from "react";
import type { WorldDocument } from "../types";
import {
  DocumentDraftSession,
  documentDrafts,
  readDocumentBackup,
  draftKey,
  type DraftIdentity,
  type DraftWriter,
} from "./documentDrafts";
import { sanitizeDocumentHtml } from "./documentHtml";
export function useDocumentDraft(
  identity: Omit<DraftIdentity, "documentId">,
  doc: WorldDocument | null,
  editing: boolean,
  read: () => WorldDocument | null,
  persist: DraftWriter,
  onFinish: () => void,
) {
  const docId = doc?.id;
  const values = useRef({ doc, read, persist, identity, onFinish });
  values.current = { doc, read, persist, identity, onFinish };
  const session = useRef<DocumentDraftSession | null>(null);
  const [backupFailed, setBackupFailed] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const { workspaceId, projectId } = identity;
  useEffect(() => {
    const base = values.current.doc;
    if (!base || !docId) return;
    const key = { workspaceId, projectId, documentId: docId };
    const restored = readDocumentBackup(key, base);
    if (restored) setRecovered(true);
    if (!editing) {
      if (restored) {
        restored.content = sanitizeDocumentHtml(restored.content);
        void values.current
          .persist(restored, `recovery:${docId}`)
          .then(() => {
            const remaining = readDocumentBackup(key, base);
            if (remaining && remaining.updatedAt === restored.updatedAt)
              localStorage.removeItem(draftKey(key));
          })
          .catch(() => {});
      }
      return;
    }
    const current: DocumentDraftSession = new DocumentDraftSession(
      key,
      base,
      (): WorldDocument => {
        const state = values.current;
        const snapshot =
          state.doc?.id === base.id &&
          state.identity.workspaceId === workspaceId &&
          state.identity.projectId === projectId
            ? state.read() || base
            : current.snapshot;
        return { ...snapshot, content: sanitizeDocumentHtml(snapshot.content) };
      },
      values.current.persist,
    );
    session.current = current;
    const unregister = documentDrafts.register(current, () =>
      values.current.onFinish(),
    );
    const interval = setInterval(() => {
      current.backup();
      setBackupFailed(current.backupFailed);
    }, 5000);
    const backup = () => current.backup();
    window.addEventListener("beforeunload", backup);
    window.addEventListener("pagehide", backup);
    return () => {
      // Capture DOM before it is removed; later callbacks cannot read another document.
      current.freeze();
      current.dispose();
      unregister();
      session.current = null;
      clearInterval(interval);
      window.removeEventListener("beforeunload", backup);
      window.removeEventListener("pagehide", backup);
    };
  }, [workspaceId, projectId, docId, editing]);
  return {
    backupFailed,
    recovered,
    dismissRecovery: () => setRecovered(false),
    changed: () => session.current?.changed(),
    flush: async () => (session.current ? session.current.commit() : true),
  };
}
