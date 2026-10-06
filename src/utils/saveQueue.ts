// Keep writes ordered, including writes to a previous workspace after switching.
const queues = new Map<unknown, Promise<unknown>>();
export function enqueueSave<T>(
  key: unknown,
  write: () => Promise<T>,
): Promise<T> {
  const next = (queues.get(key) || Promise.resolve())
    .catch(() => {})
    .then(write);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => {});
  return next;
}
