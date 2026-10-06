import type { WorldProject } from "../types";
// Reuse unchanged branches. Strings/images are compared directly, without JSON allocation.
function reuse(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous;
  if (
    !previous ||
    !next ||
    typeof previous !== "object" ||
    typeof next !== "object"
  )
    return next;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const result = next.map((item, index) => reuse(previous[index], item));
    return previous.length === result.length &&
      result.every((item, index) => item === previous[index])
      ? previous
      : result;
  }
  if (Array.isArray(previous) || Array.isArray(next)) return next;
  const a = previous as Record<string, unknown>,
    b = next as Record<string, unknown>;
  const keys = Object.keys(b).filter(
    (key) => key !== "updatedAt" && b[key] !== undefined,
  );
  const oldKeys = Object.keys(a).filter(
    (key) => key !== "updatedAt" && a[key] !== undefined,
  );
  const result = { ...b };
  for (const key of keys) result[key] = reuse(a[key], b[key]);
  return keys.length === oldKeys.length &&
    keys.every((key) => Object.hasOwn(a, key) && result[key] === a[key])
    ? previous
    : result;
}
export function reuseProject(
  previous: WorldProject,
  next: WorldProject,
): WorldProject {
  return reuse(previous, next) as WorldProject;
}
export function appendHistory(
  stack: WorldProject[],
  index: number,
  project: WorldProject,
) {
  const previous = stack[index];
  if (previous && reuseProject(previous, project) === previous)
    return { stack, index };
  const next = [...stack.slice(0, index + 1), project].slice(-51);
  return { stack: next, index: next.length - 1 };
}
