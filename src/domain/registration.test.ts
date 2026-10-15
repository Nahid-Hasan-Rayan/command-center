/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import { describe, expect, it } from "vitest";
import {
  allowedWhileUnapproved,
  availableActions,
  canUseApp,
  DEFAULT_APPROVAL_FEATURES,
  isRemovalOption,
  normalizeMatric,
  normalizeWhatsapp,
  parseAccountStatus,
  parseEntitlements,
  pendingCopy,
  REMOVAL_OPTIONS,
  statusLabel,
  statusTone,
} from "./registration";

describe("account status", () => {
  it("only approved accounts can use the app", () => {
    expect(canUseApp("approved")).toBe(true);
    for (const status of ["pending", "rejected", "suspended", "banned", "removed"] as const) {
      expect(canUseApp(status)).toBe(false);
    }
  });

  it("treats unknown values as pending, the safe default", () => {
    expect(parseAccountStatus("approved")).toBe("approved");
    expect(parseAccountStatus("hacker")).toBe("pending");
    expect(parseAccountStatus(null)).toBe("pending");
  });

  it("labels and tones every status", () => {
    expect(statusLabel("pending")).toBe("Awaiting approval");
    expect(statusTone("approved")).toBe("accent");
    expect(statusTone("pending")).toBe("warn");
    expect(statusTone("banned")).toBe("neutral");
  });

  it("explains each status without promising what it cannot", () => {
    expect(pendingCopy("pending").title).toMatch(/administrator/i);
    expect(pendingCopy("banned").body).not.toMatch(/restore/i);
    expect(pendingCopy("suspended").body).toMatch(/kept/i);
  });
});

describe("removal options", () => {
  it("offers four explicit choices and marks the irreversible ones", () => {
    expect(REMOVAL_OPTIONS.map((option) => option.id)).toEqual([
      "suspend",
      "archive",
      "ban",
      "delete",
    ]);
    expect(REMOVAL_OPTIONS.filter((option) => !option.reversible).map((o) => o.id)).toEqual([
      "ban",
      "delete",
    ]);
  });

  it("rejects values that are not options", () => {
    expect(isRemovalOption("delete")).toBe(true);
    expect(isRemovalOption("")).toBe(false);
    expect(isRemovalOption("nuke")).toBe(false);
  });
});

describe("default features", () => {
  it("does not hand out custom tools or analytics by default", () => {
    expect(DEFAULT_APPROVAL_FEATURES).not.toContain("widgets");
    expect(DEFAULT_APPROVAL_FEATURES).not.toContain("analytics");
  });

  it("drops unknown feature names", () => {
    expect(parseEntitlements(["notes", "bogus", "files"])).toEqual(["notes", "files"]);
  });
});

describe("contact details", () => {
  it("accepts common WhatsApp formats", () => {
    expect(normalizeWhatsapp("+60 12-345 6789")).toBe("+60 12-345 6789");
    expect(normalizeWhatsapp("  012 3456789 ")).toBe("012 3456789");
    expect(normalizeWhatsapp("(03) 1234 5678")).toBe("(03) 1234 5678");
  });

  it("rejects text, short and overlong numbers", () => {
    expect(normalizeWhatsapp("call me")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("+".padEnd(30, "1"))).toBeNull();
    expect(normalizeWhatsapp("1234567890123456")).toBeNull();
  });

  it("upper-cases and checks matric ids", () => {
    expect(normalizeMatric(" a25mj0186 ")).toBe("A25MJ0186");
    expect(normalizeMatric("ab")).toBeNull();
    expect(normalizeMatric("A25 MJ")).toBeNull();
  });
});

describe("pages before approval", () => {
  it("allows only sign-in, second-factor, invitations and the waiting page", () => {
    for (const path of ["/pending", "/mfa/enroll", "/mfa/verify", "/login", "/invite/abc"]) {
      expect(allowedWhileUnapproved(path)).toBe(true);
    }
    for (const path of ["/", "/week", "/messages", "/files", "/widgets", "/people", "/admin"]) {
      expect(allowedWhileUnapproved(path)).toBe(false);
    }
  });

  it("does not treat lookalike paths as allowed", () => {
    expect(allowedWhileUnapproved("/pending/../admin")).toBe(false);
    expect(allowedWhileUnapproved("/pendingx")).toBe(false);
  });
});

describe("management actions", () => {
  it("offers sensible next steps per status", () => {
    expect(availableActions("pending")).toEqual(["approve", "reject"]);
    expect(availableActions("rejected")).toEqual(["approve"]);
    expect(availableActions("approved")).toEqual(["suspend"]);
    expect(availableActions("suspended")).toEqual(["reinstate"]);
    expect(availableActions("removed")).toEqual(["reinstate"]);
    expect(availableActions("banned")).toEqual([]);
  });
});
