import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleHandler } from "../server/google.mjs";
const env = {
  APP_URL: "http://localhost:4175",
  GOOGLE_CLIENT_ID: "test-id",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_ALLOWED_EMAIL: "owner@example.com",
  SESSION_SECRET: Buffer.alloc(32, 7).toString("base64"),
};
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(body = "") {
      this.body = body;
    },
  };
}
const call = async (handler, url, headers = {}, method = "GET") => {
  const res = response();
  await handler({ url, headers, method }, res);
  return res;
};
const cookie = (res) =>
  []
    .concat(res.headers["set-cookie"] ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
function fixture(email = "owner@example.com", verified = true) {
  let params,
    calls = 0;
  const client = {
    generateAuthUrl(p) {
      params = p;
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${p.state}`;
    },
    async getToken() {
      return {
        tokens: {
          access_token: "access-secret",
          id_token: "id-token",
          expiry_date: Date.now() + 3600000,
          scope:
            "openid email https://www.googleapis.com/auth/calendar.events.readonly",
        },
      };
    },
    async verifyIdToken() {
      return {
        getPayload: () => ({
          email,
          email_verified: verified,
          nonce: params.nonce,
        }),
      };
    },
    async revokeToken() {},
  };
  const fetcher = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: "x",
            summary: "실제 일정",
            start: { dateTime: "2026-10-03T09:00:00+09:00" },
            end: { dateTime: "2026-10-03T10:00:00+09:00" },
          },
        ],
      }),
    };
  };
  const handler = createGoogleHandler({
    env,
    clientFactory: () => client,
    fetcher,
  });
  return {
    handler,
    get params() {
      return params;
    },
    get calls() {
      return calls;
    },
  };
}
async function login(f) {
  const start = await call(f.handler, "/api/google/login");
  const done = await call(
    f.handler,
    `/api/google/callback?code=fake&state=${f.params.state}`,
    { cookie: cookie(start) },
  );
  return { start, done };
}
test("unconfigured server exposes no secrets and blocks login", async () => {
  const h = createGoogleHandler({ env: {} });
  assert.deepEqual(JSON.parse((await call(h, "/api/google/status")).body), {
    configured: false,
    connected: false,
  });
  assert.equal((await call(h, "/api/google/login")).statusCode, 503);
});
test("OAuth uses read-only scope, PKCE and HttpOnly state; invalid state rejected before exchange", async () => {
  const f = fixture();
  const r = await call(f.handler, "/api/google/login");
  assert.equal(r.statusCode, 302);
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.equal(f.params.code_challenge_method, "S256");
  assert.ok(
    !f.params.scope.some((v) => v.includes("gmail") || v.includes("owned")),
  );
  const bad = await call(f.handler, "/api/google/callback?state=wrong&code=x", {
    cookie: cookie(r),
  });
  assert.match(bad.headers.location, /auth=failed/);
});
test("owner login yields encrypted session, status contains no token and calendar is authenticated", async () => {
  const f = fixture();
  const { done } = await login(f);
  assert.match(done.headers.location, /auth=connected/);
  const c = cookie(done);
  assert.ok(!c.includes("access-secret"));
  const status = JSON.parse(
    (await call(f.handler, "/api/google/status", { cookie: c })).body,
  );
  assert.equal(status.email, "owner@example.com");
  assert.ok(!JSON.stringify(status).includes("access-secret"));
  assert.equal(
    (await call(f.handler, "/api/google/calendar?date=2026-10-03")).statusCode,
    401,
  );
  const cal = await call(f.handler, "/api/google/calendar?date=2026-10-03", {
    cookie: c,
  });
  assert.equal(JSON.parse(cal.body).events[0].title, "실제 일정");
  assert.equal(f.calls, 1);
});
test("different account or unverified email is not permitted", async () => {
  for (const f of [
    fixture("other@example.com"),
    fixture("owner@example.com", false),
  ]) {
    const { done } = await login(f);
    assert.match(done.headers.location, /auth=failed/);
    assert.ok(!cookie(done).includes("dashboard_session=ey"));
  }
});
test("bad date is rejected, tampered session cannot read calendar, logout checks origin and method", async () => {
  const f = fixture();
  const { done } = await login(f);
  const c = cookie(done);
  assert.equal(
    (
      await call(f.handler, "/api/google/calendar?date=2026-02-30", {
        cookie: c,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(f.handler, "/api/google/status", {
        cookie: c.replace(/dashboard_session=./, "dashboard_session=z"),
      })
    ).body.includes('"connected":false'),
    true,
  );
  assert.equal(
    (await call(f.handler, "/api/google/logout", { cookie: c }, "GET"))
      .statusCode,
    405,
  );
  assert.equal(
    (
      await call(
        f.handler,
        "/api/google/logout",
        { cookie: c, origin: "https://evil.example" },
        "POST",
      )
    ).statusCode,
    403,
  );
  const out = await call(
    f.handler,
    "/api/google/logout",
    { cookie: c, origin: env.APP_URL },
    "POST",
  );
  assert.equal(out.statusCode, 200);
  assert.match(out.headers["set-cookie"][0], /Max-Age=0/);
});
