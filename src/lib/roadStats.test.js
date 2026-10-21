import { describe, expect, test } from "bun:test";
import { isLiveOnly, matchesRoadFilter, roadRole, showsGarage } from "./modes";
import { roadBreakdown } from "./roadStats";

describe("Driver and Passenger rules", () => {
  test("Driver uses live GPS", () => expect(isLiveOnly("driver")).toBe(true));
  test("Passenger uses live GPS", () => expect(isLiveOnly("passenger")).toBe(true));
  test("Passenger has the Garage selector", () => expect(showsGarage("passenger")).toBe(true));
  test("Driver does not inherit a passenger vehicle", () => expect(showsGarage("driver")).toBe(false));
  test("existing Drive trips default to Passenger", () => expect(roadRole("taxi")).toBe("passenger"));
  test("default road filter includes both modes", () => {
    expect(matchesRoadFilter("driver", "both")).toBe(true);
    expect(matchesRoadFilter("passenger", "both")).toBe(true);
  });
  test("Driver filter excludes Passenger", () => {
    expect(matchesRoadFilter("driver", "driver")).toBe(true);
    expect(matchesRoadFilter("passenger", "driver")).toBe(false);
  });
  test("Passenger filter excludes Driver", () => {
    expect(matchesRoadFilter("passenger", "passenger")).toBe(true);
    expect(matchesRoadFilter("driver", "passenger")).toBe(false);
  });
  test("Stats keeps role distances and times separate", () => {
    const trips = [
      { mode: "driver", distance_km: 30, start_time: "2026-10-21T01:00:00Z", end_time: "2026-10-21T01:30:00Z" },
      { mode: "passenger", distance_km: 50, start_time: "2026-10-21T01:00:00Z", end_time: "2026-10-21T02:00:00Z" },
      { mode: "train", distance_km: 100, start_time: "2026-10-21T01:00:00Z", end_time: "2026-10-21T03:00:00Z" },
    ];
    expect(roadBreakdown(trips)).toEqual({ driver: { count: 1, km: 30, minutes: 30 }, passenger: { count: 1, km: 50, minutes: 60 } });
  });
});