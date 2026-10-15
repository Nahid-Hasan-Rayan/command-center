/**
 * NHR
 * @author Nahid Hasan Rayan
 */

import { type Feature, isFeature } from "./features";

export const ACCOUNT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
  "banned",
  "removed",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function isAccountStatus(value: string): value is AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function parseAccountStatus(value: string | null | undefined): AccountStatus {
  return value && isAccountStatus(value) ? value : "pending";
}

export function canUseApp(status: AccountStatus): boolean {
  return status === "approved";
}

export type StatusTone = "neutral" | "warn" | "accent";

export function statusLabel(status: AccountStatus): string {
  const labels: Record<AccountStatus, string> = {
    pending: "Awaiting approval",
    approved: "Approved",
    rejected: "Not approved",
    suspended: "Suspended",
    banned: "Banned",
    removed: "Archived",
  };
  return labels[status];
}

export function statusTone(status: AccountStatus): StatusTone {
  if (status === "approved") {
    return "accent";
  }
  if (status === "pending") {
    return "warn";
  }
  return "neutral";
}

export interface PendingCopy {
  title: string;
  body: string;
}

export function pendingCopy(status: AccountStatus): PendingCopy {
  switch (status) {
    case "approved":
      return { title: "You are approved", body: "Your account is active." };
    case "rejected":
      return {
        title: "Your request was not approved",
        body: "The administrator did not approve this request. If you think this is a mistake, contact them directly.",
      };
    case "suspended":
      return {
        title: "Your access is paused",
        body: "The administrator has paused your account. Your data is kept. Contact them to ask why or to restore it.",
      };
    case "banned":
      return {
        title: "Your access has been removed",
        body: "This account can no longer be used.",
      };
    case "removed":
      return {
        title: "Your account is archived",
        body: "Your account was archived by the administrator. Your data is kept. Contact them to restore it.",
      };
    default:
      return {
        title: "Your request is with the administrator",
        body: "You will get access as soon as it is approved. Nothing else is needed from you.",
      };
  }
}

/** Removal always needs an explicit choice. Nothing is preselected in the form. */
export const REMOVAL_OPTIONS = [
  {
    id: "suspend",
    label: "Suspend",
    description: "Block access. Everything is kept. You can restore the account later.",
    reversible: true,
  },
  {
    id: "archive",
    label: "Archive",
    description: "Deactivate the account and keep its data. You can restore the account later.",
    reversible: true,
  },
  {
    id: "ban",
    label: "Ban",
    description: "Block access and refuse any new sign-up with this email address.",
    reversible: false,
  },
  {
    id: "delete",
    label: "Delete permanently",
    description: "Erase the account and all of its data. This cannot be undone.",
    reversible: false,
  },
] as const;

export type RemovalOption = (typeof REMOVAL_OPTIONS)[number]["id"];

export function isRemovalOption(value: string): value is RemovalOption {
  return REMOVAL_OPTIONS.some((option) => option.id === value);
}

/** Features offered by default when approving someone. Custom tools run uploaded HTML, so it is opt-in. */
export const DEFAULT_APPROVAL_FEATURES: readonly Feature[] = [
  "calendar",
  "courses",
  "study",
  "goals",
  "notes",
  "files",
  "messages",
];

export function parseEntitlements(values: readonly string[]): Feature[] {
  return values.filter(isFeature);
}

const WHATSAPP_PATTERN = /^\+?[0-9 ()-]{7,20}$/;
const MATRIC_PATTERN = /^[A-Z0-9-]{4,20}$/;

/** Returns a tidy WhatsApp number or null when it is not usable. Mirrors the database check. */
export function normalizeWhatsapp(input: string): string | null {
  const value = input.trim().replace(/\s+/g, " ");
  if (!WHATSAPP_PATTERN.test(value)) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? value : null;
}

/** Returns an upper-cased matric id or null. Mirrors the database check. */
export function normalizeMatric(input: string): string | null {
  const value = input.trim().toUpperCase();
  return MATRIC_PATTERN.test(value) ? value : null;
}

const UNAPPROVED_PATHS = ["/pending", "/mfa/enroll", "/mfa/verify", "/login", "/signup"];
const UNAPPROVED_PREFIXES = ["/invite/"];

/** Pages an account may open before it is approved. Everything else sends it to /pending. */
export function allowedWhileUnapproved(pathname: string): boolean {
  return (
    UNAPPROVED_PATHS.includes(pathname) ||
    UNAPPROVED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export type ManageAction = "approve" | "reject" | "suspend" | "reinstate";

/** Which decisions make sense for an account in this status. */
export function availableActions(status: AccountStatus): ManageAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject"];
    case "rejected":
      return ["approve"];
    case "approved":
      return ["suspend"];
    case "suspended":
    case "removed":
      return ["reinstate"];
    default:
      return [];
  }
}
