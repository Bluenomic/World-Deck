import { useCallback, useReducer, useRef } from "react";
import {
  projectReducer,
  initialProjectState,
  type ProjectAction,
} from "./projectReducer";
export function useProjects() {
  const [state, dispatch] = useReducer(projectReducer, initialProjectState);
  const stateRef = useRef(state);
  const worldsRef = useRef(state.worlds);
  const send = useCallback((action: ProjectAction) => {
    const next = projectReducer(stateRef.current, action);
    stateRef.current = next;
    worldsRef.current = next.worlds;
    dispatch(action);
    return next;
  }, []);
  return { state, stateRef, worldsRef, send };
}
