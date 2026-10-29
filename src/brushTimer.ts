export const TARGET_MS = 2 * 60 * 1000;

// Detection flickers frame to frame, so a lost detection keeps counting this long.
export const GRACE_MS = 1500;

export interface BrushState {
  elapsedMs: number;
  graceLeftMs: number;
  done: boolean;
}

export const initialBrushState: BrushState = {
  elapsedMs: 0,
  graceLeftMs: 0,
  done: false,
};

/** Advance the session by `dtMs`. Time only counts while `brushing` (or inside the grace window). */
export function advance(
  state: BrushState,
  dtMs: number,
  brushing: boolean,
  targetMs: number = TARGET_MS,
): BrushState {
  if (state.done) return state;

  const graceLeftMs = brushing ? GRACE_MS : Math.max(0, state.graceLeftMs - dtMs);
  const counting = brushing || state.graceLeftMs > 0;
  const elapsedMs = counting ? Math.min(targetMs, state.elapsedMs + dtMs) : state.elapsedMs;

  return { elapsedMs, graceLeftMs, done: elapsedMs >= targetMs };
}
