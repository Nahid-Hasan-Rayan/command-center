/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import { catalogRows, findCatalogCourse, STUDY_CATALOG } from "./study-catalog";

describe("study catalog", () => {
  it("contains the four course notebooks with every unit", () => {
    expect(STUDY_CATALOG.map((course) => course.id)).toEqual(["dsa", "hci", "os", "agile"]);
    const counts = Object.fromEntries(
      STUDY_CATALOG.map((course) => [course.id, catalogRows(course).length]),
    );
    expect(counts).toEqual({ dsa: 74, hci: 53, os: 62, agile: 63 });
  });

  it("has unique unit keys per course and fits the database limits", () => {
    for (const course of STUDY_CATALOG) {
      const rows = catalogRows(course);
      expect(new Set(rows.map((row) => row.unit_key)).size).toBe(rows.length);
      expect(course.code.length).toBeLessThanOrEqual(20);
      expect(course.title.length).toBeLessThanOrEqual(120);
      expect(course.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      for (const row of rows) {
        expect(row.unit_key.length).toBeLessThanOrEqual(80);
        expect(row.topic.length).toBeLessThanOrEqual(160);
        expect(row.title.length).toBeGreaterThan(0);
        expect(row.title.length).toBeLessThanOrEqual(200);
      }
    }
  });

  it("numbers units in order from zero", () => {
    const rows = catalogRows(STUDY_CATALOG[0] as (typeof STUDY_CATALOG)[number]);
    expect(rows.map((row) => row.position)).toEqual(rows.map((_, index) => index));
  });

  it("finds a course by id", () => {
    expect(findCatalogCourse("os")?.code).toBe("OS");
    expect(findCatalogCourse("nope")).toBeUndefined();
  });
});
