import { useEffect } from "react";
/** Covers existing composed dialogs, including nested image and document dialogs. */
export function useModalAccessibility(language: "id" | "en") {
  useEffect(() => {
    const previousFocus = new Map<HTMLElement, HTMLElement | null>();
    const dialogs = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '.modal-animate-appear, [role="dialog"], [role="alertdialog"]',
        ),
      ].filter((element) => element.getClientRects().length > 0);
    const focusable = (root: HTMLElement) =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [contenteditable="true"], [tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length > 0);
    const refresh = () => {
      for (const [dialog, previous] of previousFocus)
        if (!dialog.isConnected || !dialog.getClientRects().length) {
          previousFocus.delete(dialog);
          if (previous?.isConnected) previous.focus();
        }
      for (const dialog of dialogs()) {
        if (previousFocus.has(dialog)) continue;
        previousFocus.set(
          dialog,
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
        );
        if (!dialog.hasAttribute("role")) dialog.setAttribute("role", "dialog");
        dialog.setAttribute("aria-modal", "true");
        const heading = dialog.querySelector("h1,h2,h3");
        if (
          !dialog.hasAttribute("aria-label") &&
          !dialog.hasAttribute("aria-labelledby")
        )
          dialog.setAttribute(
            "aria-label",
            heading?.textContent?.trim() ||
              (language === "en" ? "Dialog" : "Dialog"),
          );
        if (!dialog.contains(document.activeElement))
          (focusable(dialog)[0] || dialog).focus();
      }
      for (const button of document.querySelectorAll<HTMLButtonElement>(
        "button",
      )) {
        if (button.getAttribute("aria-label") || button.textContent?.trim())
          continue;
        const icon = button.querySelector("svg");
        const labels: Record<string, [string, string]> = {
          x: ["Tutup", "Close"],
          plus: ["Tambah", "Add"],
          minus: ["Kurangi", "Decrease"],
          "chevron-left": ["Sebelumnya", "Previous"],
          "chevron-right": ["Berikutnya", "Next"],
          "chevron-down": ["Buka pilihan", "Open options"],
          "chevron-up": ["Tutup pilihan", "Collapse"],
          trash2: ["Hapus", "Delete"],
          "trash-2": ["Hapus", "Delete"],
          "more-horizontal": ["Pilihan lain", "More options"],
          "more-vertical": ["Pilihan lain", "More options"],
        };
        const iconName = [...(icon?.classList || [])]
          .find((name) => name.startsWith("lucide-") && name !== "lucide-icon")
          ?.slice(7);
        const label =
          button.title ||
          (iconName && labels[iconName]?.[language === "en" ? 1 : 0]);
        if (label) button.setAttribute("aria-label", label);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      const top = dialogs().at(-1);
      if (!top) return;
      if (event.key === "Escape") {
        const close = [
          ...top.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        ].find(
          (button) =>
            /^(close|cancel|tutup|batal)$/i.test(
              button.getAttribute("aria-label") ||
                button.title ||
                button.textContent?.trim() ||
                "",
            ) || button.querySelector("svg.lucide-x"),
        );
        if (close) {
          event.preventDefault();
          event.stopPropagation();
          close.click();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const elements = [
          ...focusable(top),
          ...document.querySelectorAll<HTMLElement>(
            "[data-workspace-error] button:not(:disabled)",
          ),
        ],
        first = elements[0],
        last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !elements.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !elements.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true });
    document.addEventListener("keydown", keydown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keydown, true);
    };
  }, [language]);
}
