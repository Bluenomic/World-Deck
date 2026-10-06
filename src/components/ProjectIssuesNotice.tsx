import { useState } from "react";
import type { ProjectIssue } from "../utils/projectValidation";
import { useLanguage } from "../i18n/useLanguage";
const labels: Record<string, [string, string]> = {
  invalid_field: ["Field tidak valid", "Invalid field"],
  unsupported_schema: [
    "Versi format belum didukung",
    "Unsupported format version",
  ],
  duplicate_id: ["ID duplikat", "Duplicate ID"],
  broken_reference: ["Referensi terputus", "Broken reference"],
  unreadable_project: [
    "Proyek dan backup tidak dapat dibaca",
    "Project and backup could not be read",
  ],
  backup_recovered: [
    "Proyek dipulihkan dari backup",
    "Project recovered from backup",
  ],
  missing_asset: ["Gambar tidak ditemukan", "Image asset missing"],
  map_cycle: ["Hubungan induk peta membentuk siklus", "Cyclic map hierarchy"],
};
export function ProjectIssuesNotice({ issues }: { issues: ProjectIssue[] }) {
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState("");
  const unique = [
    ...new Map(issues.map((issue) => [JSON.stringify(issue), issue])).values(),
  ];
  const signature = JSON.stringify(unique);
  if (!unique.length || dismissed === signature) return null;
  return (
    <div
      role="status"
      className="absolute bottom-4 right-4 z-40 max-w-md rounded-lg border border-amber-500/50 app-bg-secondary p-3 text-xs app-text-main shadow-lg"
    >
      <div className="flex items-start gap-4">
        <details>
          <summary className="cursor-pointer">
            {language === "en"
              ? `${unique.length} project issues`
              : `${unique.length} masalah proyek`}
          </summary>
          <ul className="max-h-52 overflow-auto mt-2 space-y-2">
            {unique.map((issue, i) => (
              <li key={i} data-project-issue={issue.code}>
                <strong>
                  {labels[issue.code]?.[language === "en" ? 1 : 0] ||
                    issue.code}
                </strong>
                <br />
                {issue.fileName || issue.projectId} · {issue.path}
              </li>
            ))}
          </ul>
        </details>
        <button
          type="button"
          aria-label={
            language === "en"
              ? "Dismiss project issues"
              : "Tutup laporan proyek"
          }
          onClick={() => setDismissed(signature)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
