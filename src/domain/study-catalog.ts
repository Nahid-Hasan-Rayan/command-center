/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import catalog from "@/data/study-catalog.json";

export interface CatalogUnit {
  key: string;
  title: string;
}

export interface CatalogTopic {
  title: string;
  units: CatalogUnit[];
}

export interface CatalogCourse {
  id: string;
  code: string;
  title: string;
  color: string;
  topics: CatalogTopic[];
}

export const STUDY_CATALOG: readonly CatalogCourse[] = catalog.courses;

export function findCatalogCourse(id: string): CatalogCourse | undefined {
  return STUDY_CATALOG.find((course) => course.id === id);
}

export interface CatalogRow {
  unit_key: string;
  topic: string;
  title: string;
  position: number;
}

/** Flat, ordered rows for inserting a catalog course's units. */
export function catalogRows(course: CatalogCourse): CatalogRow[] {
  let position = 0;
  return course.topics.flatMap((topic) =>
    topic.units.map((unit) => ({
      unit_key: unit.key,
      topic: topic.title,
      title: unit.title,
      position: position++,
    })),
  );
}
