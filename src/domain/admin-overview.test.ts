/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  type AdminOverview,
  barHeights,
  formatMs,
  healthLabel,
  healthOf,
  overviewSchema,
  totalUsers,
  userCount,
} from "./admin-overview";

const base: AdminOverview = {
  users: { approved: 4, pending: 2, banned: 1 },
  signups_14d: [],
  active_users_7d: 3,
  messages_7d: 10,
  study_minutes_7d: 120,
  open_bugs: 0,
  errors_24h: 0,
  errors_7d: 0,
  top_errors: [],
  timings: [],
};

describe("admin overview", () => {
  it("accepts what the database returns and rejects nonsense", () => {
    expect(overviewSchema.safeParse(base).success).toBe(true);
    expect(overviewSchema.safeParse({ ...base, open_bugs: "many" }).success).toBe(false);
    expect(overviewSchema.safeParse({}).success).toBe(false);
  });

  it("counts people by status and in total", () => {
    expect(userCount(base, "approved")).toBe(4);
    expect(userCount(base, "removed")).toBe(0);
    expect(totalUsers(base)).toBe(7);
  });

  it("scales bars to the tallest value and handles an empty series", () => {
    expect(barHeights([0, 5, 10])).toEqual([0, 50, 100]);
    expect(barHeights([0, 0])).toEqual([0, 0]);
    expect(barHeights([])).toEqual([]);
  });

  it("formats durations", () => {
    expect(formatMs(null)).toBe("-");
    expect(formatMs(120)).toBe("120 ms");
    expect(formatMs(999.4)).toBe("999 ms");
    expect(formatMs(1500)).toBe("1.5 s");
  });

  it("grades health by recent errors, slow actions and open bugs", () => {
    expect(healthOf(base)).toBe("good");
    expect(healthOf({ ...base, errors_24h: 1 })).toBe("watch");
    expect(healthOf({ ...base, open_bugs: 5 })).toBe("watch");
    expect(
      healthOf({ ...base, timings: [{ name: "x", count: 3, p50_ms: 100, p95_ms: 2500 }] }),
    ).toBe("watch");
    expect(healthOf({ ...base, errors_24h: 10 })).toBe("bad");
    expect(
      healthOf({ ...base, timings: [{ name: "x", count: 3, p50_ms: 100, p95_ms: 6000 }] }),
    ).toBe("bad");
    expect(healthLabel("bad")).toBe("Needs attention");
  });
});
