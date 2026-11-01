import { describe, expect, test } from "bun:test";
import { waypointEditorReducer, waypointRange } from "./waypointEditor";

const points = Array.from({ length: 15 }, (_, i) => [43 + i / 1000, -79]);
const initial = () => ({ points, history: [], movingIndex: null });

describe("Waypoint selection and undo", () => {
  test("first and last select all 12 points inclusively", () => {
    expect(waypointRange(1, 12)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(waypointRange(12, 1)).toEqual(waypointRange(1, 12));
  });
  test("deleting 12 points keeps the remaining route in order", () => {
    const result = waypointEditorReducer(initial(), { type: "delete", indices: waypointRange(1, 12) });
    expect(result.points).toEqual([points[0], points[13], points[14]]);
  });
  test("nonadjacent selected points are deleted without deleting others", () => {
    expect(waypointEditorReducer(initial(), { type: "delete", indices: [1, 4, 9] }).points)
      .toEqual(points.filter((_, i) => ![1, 4, 9].includes(i)));
  });
  test("undo restores deleted points and their exact original order", () => {
    const deleted = waypointEditorReducer(initial(), { type: "delete", indices: waypointRange(1, 12) });
    expect(waypointEditorReducer(deleted, { type: "undo" }).points).toEqual(points);
  });
  test("deleting all points can be undone", () => {
    const deleted = waypointEditorReducer(initial(), { type: "delete", indices: waypointRange(0, 14) });
    expect(deleted.points).toEqual([]);
    expect(waypointEditorReducer(deleted, { type: "undo" }).points).toEqual(points);
  });
  test("one drag is one undo action", () => {
    let state = waypointEditorReducer(initial(), { type: "move", index: 1, point: [44, -79] });
    state = waypointEditorReducer(state, { type: "move", index: 1, point: [45, -79] });
    expect(state.history.length).toBe(1);
    expect(waypointEditorReducer(state, { type: "undo" }).points).toEqual(points);
  });
});