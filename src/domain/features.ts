/**
 * NHR
 * @author Nahid Hasan Rayan
 */

export const FEATURES = [
  "calendar",
  "courses",
  "study",
  "career",
  "goals",
  "notes",
  "analytics",
  "messages",
  "files",
  "widgets",
] as const;

export type Feature = (typeof FEATURES)[number];
export type Role = "owner" | "editor" | "viewer";
export type InvitableRole = Exclude<Role, "owner">;

export interface FeatureInfo {
  id: Feature;
  label: string;
  description: string;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  role: InvitableRole;
  features: readonly Feature[];
}

export interface Membership {
  role: Role;
  features: readonly Feature[];
}

export type RouteTarget = Feature | "people";

export const FEATURE_CATALOG: readonly FeatureInfo[] = [
  { id: "calendar", label: "Calendar", description: "Today, week and semester views." },
  { id: "courses", label: "Courses", description: "Courses, assessments and attendance." },
  { id: "study", label: "Study", description: "Reviews, habits and study blocks." },
  { id: "career", label: "Career", description: "Applications, rules and country research." },
  { id: "goals", label: "Goals", description: "Goals, projects and decisions." },
  { id: "notes", label: "Notes", description: "Notes and pages." },
  { id: "analytics", label: "Analytics", description: "Charts and forecasts." },
  { id: "messages", label: "Messages", description: "Channels and direct messages." },
  { id: "files", label: "Files", description: "Shared files." },
  { id: "widgets", label: "Custom tools", description: "Uploaded HTML tools." },
];

export const PRESETS: readonly Preset[] = [
  {
    id: "study-buddy",
    label: "Study buddy",
    description: "Sees your calendar and courses, and can chat.",
    role: "viewer",
    features: ["calendar", "courses", "messages"],
  },
  {
    id: "mentor",
    label: "Mentor",
    description: "Reads goals and career progress, and can chat and share files.",
    role: "viewer",
    features: ["goals", "career", "messages", "files"],
  },
  {
    id: "collaborator",
    label: "Collaborator",
    description: "Works with you on notes, files, tools and messages.",
    role: "editor",
    features: ["notes", "files", "widgets", "messages"],
  },
];

const ROUTE_TARGETS: readonly { prefix: string; target: RouteTarget }[] = [
  { prefix: "/week", target: "calendar" },
  { prefix: "/semester", target: "calendar" },
  { prefix: "/messages", target: "messages" },
  { prefix: "/files", target: "files" },
  { prefix: "/widgets", target: "widgets" },
  { prefix: "/people", target: "people" },
];

export function isFeature(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value);
}

export function parseFeatures(values: readonly string[]): Feature[] {
  return [...new Set(values.filter(isFeature))];
}

export function canView(membership: Membership, feature: Feature): boolean {
  return membership.role === "owner" || membership.features.includes(feature);
}

export function canWrite(membership: Membership, feature: Feature): boolean {
  return membership.role !== "viewer" && canView(membership, feature);
}

export function canManageMembers(membership: Membership): boolean {
  return membership.role === "owner";
}

export function visibleFeatures(membership: Membership): Feature[] {
  return FEATURES.filter((feature) => canView(membership, feature));
}

export function routeTarget(pathname: string): RouteTarget | null {
  if (pathname === "/") {
    return "calendar";
  }
  const match = ROUTE_TARGETS.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  return match?.target ?? null;
}
