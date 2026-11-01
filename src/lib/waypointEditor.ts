export type Waypoint = [number, number];
export type WaypointEditorState = {
  points: Waypoint[];
  history: Waypoint[][];
  movingIndex: number | null;
};
export type WaypointAction =
  | { type: "replace"; points: Waypoint[] }
  | { type: "delete"; indices: number[] }
  | { type: "move"; index: number; point: Waypoint }
  | { type: "finishMove" }
  | { type: "undo" };

export function waypointRange(first: number, last: number): number[] {
  const start = Math.min(first, last);
  return Array.from({ length: Math.abs(last - first) + 1 }, (_, i) => start + i);
}

export function waypointEditorReducer(state: WaypointEditorState, action: WaypointAction): WaypointEditorState {
  if (action.type === "finishMove") return { ...state, movingIndex: null };
  if (action.type === "undo") {
    const points = state.history.at(-1);
    return points ? { points, history: state.history.slice(0, -1), movingIndex: null } : state;
  }
  if (action.type === "move" && !state.points[action.index]) return state;
  const points = action.type === "replace" ? action.points
    : action.type === "delete" ? state.points.filter((_, i) => !action.indices.includes(i))
    : state.points.map((point, i) => i === action.index ? action.point : point);
  if (JSON.stringify(points) === JSON.stringify(state.points)) return state;
  const continuingMove = action.type === "move" && state.movingIndex === action.index;
  return {
    points,
    history: continuingMove ? state.history : [...state.history, state.points],
    movingIndex: action.type === "move" ? action.index : null,
  };
}