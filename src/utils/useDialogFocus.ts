import { useEffect } from "react";

export function useDialogFocus(open: boolean, selector: string) {
  useEffect(() => {
    if (!open) return;
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Tab" || document.querySelector('[role="alertdialog"]'))
        return;
      const elements = focusable();
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !root.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !root.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", trap);
    return () => {
      root.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, selector]);
}
