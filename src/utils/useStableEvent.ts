import { useCallback, useRef } from "react";
export function useStableEvent<A extends unknown[], R>(
  callback: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: A) => ref.current(...args), []);
}
