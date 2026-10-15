/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import http from "node:http";

const BASE = process.env.BASE_URL ?? "http://localhost:3112";
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 3199);
const WS = "11111111-1111-4111-8111-111111111111";
const APPROVED = "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7f90";
const PENDING = "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7f91";
const DISABLED = "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7f92";
const TOKEN = "abcdefghijklmnopqrstuvwx";
const HOSTILE = "</script><script>alert(1)</script>";

const widgets = {
  [APPROVED]: {
    html: "<!DOCTYPE html><html><head><title>t</title></head><body>approved-body</body></html>",
    status: "approved",
    permissions: ["read:calendar"],
  },
  [PENDING]: {
    html: "<html><head></head><body>pending-body</body></html>",
    status: "pending",
    permissions: ["read:calendar"],
  },
  [DISABLED]: {
    html: "<html><body>disabled-body</body></html>",
    status: "disabled",
    permissions: [],
  },
};

const personas = {
  owner: { role: "owner", features: [] },
  viewer: { role: "viewer", features: ["calendar"] },
  tooluser: { role: "viewer", features: ["widgets"] },
  admin: { role: "owner", features: [] },
  waiting: { role: "owner", features: [] },
  paused: { role: "owner", features: [] },
};

const accounts = {
  owner: { status: "approved", is_admin: false },
  viewer: { status: "approved", is_admin: false },
  tooluser: { status: "approved", is_admin: false },
  admin: { status: "approved", is_admin: true },
  waiting: { status: "pending", is_admin: false },
  paused: { status: "suspended", is_admin: false },
};

const people = [
  {
    user_id: "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7fa1",
    email: "newcomer@example.test",
    full_name: "Nadia Newcomer",
    whatsapp: "+60 12-345 6789",
    matric_id: "A25MJ0001",
    note: "Study group",
    status: "pending",
    requested_at: "2026-10-14T01:00:00Z",
    decided_at: null,
    decision_note: null,
    is_admin: false,
    features: [],
  },
  {
    user_id: "7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7fa2",
    email: "member@example.test",
    full_name: "Mina Member",
    whatsapp: null,
    matric_id: null,
    note: null,
    status: "approved",
    requested_at: "2026-10-01T01:00:00Z",
    decided_at: "2026-10-02T01:00:00Z",
    decision_note: null,
    is_admin: false,
    features: ["notes"],
  },
];

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function jwt(persona, aal) {
  const payload = {
    sub: persona,
    aal,
    role: "authenticated",
    exp: 4102444800,
    aud: "authenticated",
  };
  return `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.sig`;
}

function cookieFor(persona, aal) {
  const session = {
    access_token: jwt(persona, aal),
    refresh_token: "refresh",
    expires_at: 4102444800,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: persona, email: `${persona}@example.test` },
  };
  return `sb-localhost-auth-token=base64-${b64url(JSON.stringify(session))}`;
}

function personaOf(request) {
  const bearer = (request.headers.authorization ?? "").replace("Bearer ", "");
  try {
    return JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString()).sub;
  } catch {
    return "owner";
  }
}

const mock = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${MOCK_PORT}`);
  const persona = personaOf(request);
  const single = (request.headers.accept ?? "").includes("vnd.pgrst.object");
  const send = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };

  if (url.pathname === "/auth/v1/user") {
    return send(200, {
      id: persona,
      email: `${persona}@example.test`,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
      factors: [{ id: "f1", factor_type: "totp", status: "verified" }],
    });
  }
  if (url.pathname === "/rest/v1/rpc/my_account") {
    const account = accounts[persona] ?? accounts.owner;
    return send(200, [
      {
        status: account.status,
        is_admin: account.is_admin,
        is_root: false,
        full_name: persona,
        features: personas[persona]?.features ?? [],
      },
    ]);
  }
  if (url.pathname === "/rest/v1/rpc/admin_list_users") {
    return accounts[persona]?.is_admin
      ? send(200, people)
      : send(403, { code: "42501", message: "administrator access required" });
  }
  if (url.pathname === "/rest/v1/rpc/admin_audit_list") {
    return send(200, [
      {
        id: 1,
        at: "2026-10-14T02:00:00Z",
        admin_email: "admin@example.test",
        action: "registration.approve",
        target_email: "member@example.test",
        detail: {},
      },
    ]);
  }
  if (url.pathname === "/rest/v1/registrations") {
    return send(
      200,
      single
        ? {
            email: `${persona}@example.test`,
            full_name: persona,
            whatsapp: "+60 12-345 6789",
            matric_id: null,
            requested_at: "2026-10-14T01:00:00Z",
            decision_note: null,
          }
        : [],
    );
  }
  if (url.pathname === "/rest/v1/workspace_members") {
    if ((accounts[persona] ?? accounts.owner).status !== "approved") {
      return send(200, []);
    }
    return send(200, [
      { workspace_id: WS, role: personas[persona].role, workspaces: { name: "Personal" } },
    ]);
  }
  if (url.pathname === "/rest/v1/member_features") {
    return send(
      200,
      personas[persona].features.map((feature) => ({ workspace_id: WS, feature })),
    );
  }
  if (url.pathname === "/rest/v1/widgets") {
    const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
    const row = widgets[id];
    if (!row) {
      return single ? send(406, { message: "none" }) : send(200, []);
    }
    return send(200, single ? row : [row]);
  }
  if (url.pathname === "/rest/v1/widget_state") {
    return send(200, single ? { data: { note: HOSTILE } } : [{ data: { note: HOSTILE } }]);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    return send(200, []);
  }
  return send(200, single ? {} : []);
});

let failures = 0;
function check(label, condition, detail = "") {
  if (!condition) {
    failures += 1;
  }
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${condition ? "" : ` ${detail}`}`);
}

async function get(path, persona, aal = "aal2") {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: persona ? { cookie: cookieFor(persona, aal) } : {},
  });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

await new Promise((resolve) => mock.listen(MOCK_PORT, resolve));

try {
  const frame = (id, token = TOKEN) => `/widgets/${id}/frame?t=${token}`;

  const approved = await get(frame(APPROVED), "owner");
  const csp = approved.headers.get("content-security-policy") ?? "";
  check("approved widget frame is served", approved.status === 200, String(approved.status));
  check("frame is forced into a sandbox by header", csp.startsWith("sandbox allow-scripts"), csp);
  check(
    "frame blocks network access",
    csp.includes("connect-src 'none'") && csp.includes("default-src 'none'"),
  );
  check(
    "frame has no framing denial so the app can embed it",
    !approved.headers.has("x-frame-options"),
  );
  check("frame can only be embedded by the app", csp.includes("frame-ancestors 'self'"));
  check("frame is not cached", (approved.headers.get("cache-control") ?? "").includes("no-store"));
  check("frame sets nosniff", approved.headers.get("x-content-type-options") === "nosniff");
  check(
    "boot script is injected right after head",
    /<head><script>window\.__CC_BOOT__=/.test(approved.text),
  );
  check("widget content is preserved", approved.text.includes("approved-body"));
  check("token is embedded", approved.text.includes(TOKEN));
  check("granted permission is passed to the frame", approved.text.includes('"read:calendar"'));
  check("stored state is passed to the frame", approved.text.includes("alert(1)"));
  check(
    "hostile state cannot break out of the script",
    !approved.text.includes(HOSTILE) && approved.text.includes("\\u003c/script\\u003e"),
  );

  const pending = await get(frame(PENDING), "owner");
  check("a pending widget can be previewed by the owner", pending.status === 200);
  check(
    "a pending preview has no permissions and no state",
    pending.text.includes('"permissions":[]') && pending.text.includes('"state":{}'),
  );
  check("a disabled widget is not served", (await get(frame(DISABLED), "owner")).status === 404);
  check(
    "an unknown widget is not served",
    (await get(frame("7d5b3a0e-3b8a-4a52-9a8e-0a1d3c5e7fff"), "owner")).status === 404,
  );
  check("a bad token is rejected", (await get(frame(APPROVED, "short"), "owner")).status === 404);
  check(
    "a missing token is rejected",
    (await get(`/widgets/${APPROVED}/frame`, "owner")).status === 404,
  );
  check(
    "a member without the tools feature cannot load a frame",
    (await get(frame(APPROVED), "viewer")).status === 404,
  );
  check(
    "a member with the tools feature can load an approved frame",
    (await get(frame(APPROVED), "tooluser")).status === 200,
  );

  const anonymous = await get(frame(APPROVED), null);
  check(
    "anonymous visitors are redirected to sign in",
    (anonymous.status === 307 && (anonymous.headers.get("location") ?? "").startsWith("/login")) ||
      anonymous.headers.get("location")?.includes("/login"),
  );

  const stepUp = await get("/", "owner", "aal1");
  check(
    "a session without the second factor is sent to verify",
    stepUp.status === 307 && (stepUp.headers.get("location") ?? "").endsWith("/mfa/verify"),
    stepUp.headers.get("location") ?? "",
  );
  const stepUpFrame = await get(frame(APPROVED), "owner", "aal1");
  check("an aal1 session cannot load a widget frame", stepUpFrame.status === 307);

  const home = await get("/", "owner");
  check(
    "owner home renders",
    home.status === 200 && home.text.includes("No calendar data in this workspace yet"),
  );
  check("owner sees the People link", home.text.includes('href="/people"'));
  check(
    "page CSP uses a nonce and denies framing",
    (home.headers.get("content-security-policy") ?? "").includes("'nonce-") &&
      home.headers.get("x-frame-options") === "DENY",
  );

  const limited = await get("/", "viewer");
  check(
    "a limited member does not see People, Messages, Files or Tools links",
    ["/people", "/messages", "/files", "/widgets"].every(
      (href) => !limited.text.includes(`href="${href}"`),
    ),
  );
  check("a limited member sees only granted features", limited.text.includes('href="/week"'));
  for (const path of ["/people", "/messages", "/files", "/widgets"]) {
    check(`a limited member gets 404 for ${path}`, (await get(path, "viewer")).status === 404);
  }
  check(
    "a non-owner cannot open the People page even with tools access",
    (await get("/people", "tooluser")).status === 404,
  );
  check("the owner can open People", (await get("/people", "owner")).status === 200);
  check(
    "the owner can open Messages, Files and Tools",
    (await Promise.all(["/messages", "/files", "/widgets"].map((p) => get(p, "owner")))).every(
      (r) => r.status === 200,
    ),
  );

  const redirectsTo = (response, path) =>
    response.status === 307 && (response.headers.get("location") ?? "").endsWith(path);

  for (const path of ["/", "/week", "/messages", "/files", "/widgets", "/people", "/admin"]) {
    check(
      `an account awaiting approval is sent from ${path} to /pending`,
      redirectsTo(await get(path, "waiting"), "/pending"),
    );
  }
  const waitingPage = await get("/pending", "waiting");
  check(
    "the waiting page explains the request",
    waitingPage.status === 200 &&
      waitingPage.text.includes("Your request is with the administrator") &&
      waitingPage.text.includes("Awaiting approval"),
  );
  check(
    "the waiting page offers no app navigation",
    ["/week", "/messages", "/files", "/widgets", "/people", "/admin"].every(
      (href) => !waitingPage.text.includes(`href="${href}"`),
    ),
  );
  check("the waiting page still offers sign out", waitingPage.text.includes("Sign out"));
  const pausedPage = await get("/pending", "paused");
  check(
    "a suspended account is told its access is paused",
    pausedPage.status === 200 && pausedPage.text.includes("Your access is paused"),
  );
  check(
    "a suspended account cannot open the app",
    redirectsTo(await get("/", "paused"), "/pending"),
  );
  check(
    "an approved account is sent away from /pending",
    redirectsTo(await get("/pending", "owner"), "/"),
  );

  check("a non-admin gets 404 for /admin", (await get("/admin", "owner")).status === 404);
  check(
    "a non-admin gets 404 for /admin/audit",
    (await get("/admin/audit", "owner")).status === 404,
  );
  check("a non-admin does not see the Admin link", !home.text.includes('href="/admin"'));
  const adminPage = await get("/admin", "admin");
  check(
    "the administrator sees requests and people",
    adminPage.status === 200 &&
      adminPage.text.includes("Nadia Newcomer") &&
      adminPage.text.includes("+60 12-345 6789") &&
      adminPage.text.includes("Mina Member"),
  );
  check(
    "removal has no preselected option",
    adminPage.text.includes('name="option"') && !/name="option"[^>]*checked/.test(adminPage.text),
  );
  check(
    "the administrator sees the Admin link",
    (await get("/", "admin")).text.includes('href="/admin"'),
  );
  const auditPage = await get("/admin/audit", "admin");
  check(
    "the administrator can read the audit trail",
    auditPage.status === 200 && auditPage.text.includes("registration.approve"),
  );
} finally {
  mock.close();
}

console.log(failures === 0 ? "all checks passed" : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
