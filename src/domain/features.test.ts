/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  canManageMembers,
  canView,
  canWrite,
  FEATURE_CATALOG,
  FEATURES,
  isFeature,
  type Membership,
  PRESETS,
  parseFeatures,
  routeTarget,
  visibleFeatures,
} from "./features";

const owner: Membership = { role: "owner", features: [] };
const editor: Membership = { role: "editor", features: ["notes", "files"] };
const viewer: Membership = { role: "viewer", features: ["calendar", "messages"] };

describe("feature visibility", () => {
  it("gives owners every feature without explicit grants", () => {
    expect(visibleFeatures(owner)).toEqual([...FEATURES]);
    expect(canManageMembers(owner)).toBe(true);
  });

  it("limits other members to granted features", () => {
    expect(visibleFeatures(viewer)).toEqual(["calendar", "messages"]);
    expect(canView(viewer, "career")).toBe(false);
    expect(canManageMembers(viewer)).toBe(false);
    expect(canManageMembers(editor)).toBe(false);
  });

  it("allows writes only for editors and owners on granted features", () => {
    expect(canWrite(editor, "notes")).toBe(true);
    expect(canWrite(editor, "career")).toBe(false);
    expect(canWrite(viewer, "calendar")).toBe(false);
    expect(canWrite(owner, "analytics")).toBe(true);
  });
});

describe("feature parsing", () => {
  it("accepts known features and removes duplicates and unknown values", () => {
    expect(parseFeatures(["notes", "notes", "bogus", "files"])).toEqual(["notes", "files"]);
    expect(isFeature("messages")).toBe(true);
    expect(isFeature("admin")).toBe(false);
  });

  it("describes every feature exactly once", () => {
    expect(FEATURE_CATALOG.map((entry) => entry.id)).toEqual([...FEATURES]);
  });

  it("only offers presets that use real features and never the owner role", () => {
    for (const preset of PRESETS) {
      expect(preset.features.every(isFeature)).toBe(true);
      expect(["viewer", "editor"]).toContain(preset.role);
    }
  });
});

describe("route targets", () => {
  it.each([
    ["/", "calendar"],
    ["/week", "calendar"],
    ["/semester", "calendar"],
    ["/messages", "messages"],
    ["/messages/abc", "messages"],
    ["/files/123/download", "files"],
    ["/widgets/abc", "widgets"],
    ["/people", "people"],
  ])("maps %s to %s", (path, target) => {
    expect(routeTarget(path)).toBe(target);
  });

  it("returns null for unknown or lookalike paths", () => {
    expect(routeTarget("/weekly")).toBeNull();
    expect(routeTarget("/peoplex")).toBeNull();
    expect(routeTarget("/login")).toBeNull();
  });
});
