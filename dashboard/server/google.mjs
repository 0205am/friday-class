import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { OAuth2Client } from "google-auth-library";

const scopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];
const SESSION = "dashboard_session",
  FLOW = "dashboard_oauth";
function configuration(env) {
  const url = new URL(env.APP_URL);
  if (
    url.origin !== env.APP_URL ||
    url.username ||
    url.password ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && url.hostname === "localhost")
    )
  )
    throw Error("Invalid app origin");
  const key = Buffer.from(env.SESSION_SECRET ?? "", "base64");
  if (
    key.length !== 32 ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_ALLOWED_EMAIL?.includes("@")
  )
    throw Error("Missing configuration");
  return {
    origin: url.origin,
    key,
    secure: url.protocol === "https:",
    email: env.GOOGLE_ALLOWED_EMAIL.trim().toLowerCase(),
    redirect: url.origin + "/api/google/callback",
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}
function seal(data, cfg, name) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cfg.key, iv);
  cipher.setAAD(Buffer.from(name + cfg.origin));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
function unseal(value, cfg, name) {
  try {
    if (!value || value.length > 6000) return null;
    const b = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cfg.key,
      b.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(name + cfg.origin));
    decipher.setAuthTag(b.subarray(12, 28));
    const result = JSON.parse(
      Buffer.concat([
        decipher.update(b.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
    return result.expires > Date.now() ? result : null;
  } catch {
    return null;
  }
}
function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map((p) => {
        const i = p.indexOf("=");
        return [p.slice(0, i).trim(), p.slice(i + 1)];
      })
      .filter(([k]) => k),
  );
}
function setCookie(name, value, seconds, cfg) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${cfg.secure ? "; Secure" : ""}`;
}
function match(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function dayBounds(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return null;
  const d = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== day)
    return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    start: day + "T00:00:00+09:00",
    end: d.toISOString().slice(0, 10) + "T00:00:00+09:00",
  };
}
export function createGoogleHandler({
  env = process.env,
  clientFactory,
  fetcher = fetch,
} = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const json = (status, data) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
    };
    const redirect = (where) => {
      res.statusCode = 302;
      res.setHeader("Location", where);
      res.end();
    };
    let cfg;
    try {
      cfg = configuration(env);
    } catch {
      cfg = null;
    }
    const url = new URL(req.url, "http://localhost"),
      action = url.pathname.split("/").at(-1);
    if (!["status", "login", "callback", "logout", "calendar"].includes(action))
      return json(404, { error: "요청한 기능이 없습니다." });
    if (req.method !== (action === "logout" ? "POST" : "GET")) {
      res.setHeader("Allow", action === "logout" ? "POST" : "GET");
      return json(405, { error: "허용되지 않은 요청입니다." });
    }
    if (!cfg)
      return action === "status"
        ? json(200, { configured: false, connected: false })
        : json(503, { error: "Google 연결 설정을 먼저 완료해 주세요." });
    const c = cookies(req),
      session = unseal(c[SESSION], cfg, SESSION);
    const owner =
      session &&
      session.email === cfg.email &&
      typeof session.token === "string";
    const client = () =>
      clientFactory
        ? clientFactory(cfg)
        : new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirect);
    if (action === "status")
      return json(200, {
        configured: true,
        connected: !!owner,
        ...(owner ? { email: session.email, expires: session.expires } : {}),
      });
    if (action === "login") {
      const state = randomBytes(32).toString("base64url"),
        nonce = randomBytes(32).toString("base64url"),
        verifier = randomBytes(32).toString("base64url");
      const flow = { state, nonce, verifier, expires: Date.now() + 600000 };
      res.setHeader("Set-Cookie", [
        setCookie(FLOW, seal(flow, cfg, FLOW), 600, cfg),
      ]);
      return redirect(
        client().generateAuthUrl({
          scope: scopes,
          state,
          nonce,
          access_type: "online",
          prompt: "select_account",
          code_challenge: createHash("sha256")
            .update(verifier)
            .digest("base64url"),
          code_challenge_method: "S256",
        }),
      );
    }
    if (action === "callback") {
      res.setHeader("Set-Cookie", [
        setCookie(FLOW, "", 0, cfg),
        setCookie(SESSION, "", 0, cfg),
      ]);
      const flow = unseal(c[FLOW], cfg, FLOW);
      if (
        !flow ||
        !match(flow.state, url.searchParams.get("state")) ||
        !url.searchParams.get("code") ||
        url.searchParams.has("error")
      )
        return redirect(cfg.origin + "/?auth=failed");
      try {
        const oauth = client();
        const { tokens } = await oauth.getToken({
          code: url.searchParams.get("code"),
          codeVerifier: flow.verifier,
          redirect_uri: cfg.redirect,
        });
        const ticket = await oauth.verifyIdToken({
          idToken: tokens.id_token,
          audience: cfg.clientId,
        });
        const identity = ticket.getPayload();
        if (
          identity?.email_verified !== true ||
          identity.email?.toLowerCase() !== cfg.email ||
          !match(identity.nonce, flow.nonce) ||
          !tokens.access_token ||
          !tokens.scope?.split(" ").includes(scopes[2])
        )
          throw Error("Not permitted");
        const expires =
          Math.min(tokens.expiry_date ?? 0, Date.now() + 3600000) - 30000;
        if (expires <= Date.now()) throw Error("Expired");
        res.setHeader("Set-Cookie", [
          setCookie(FLOW, "", 0, cfg),
          setCookie(
            SESSION,
            seal(
              { token: tokens.access_token, email: cfg.email, expires },
              cfg,
              SESSION,
            ),
            Math.floor((expires - Date.now()) / 1000),
            cfg,
          ),
        ]);
        return redirect(cfg.origin + "/?auth=connected");
      } catch {
        return redirect(cfg.origin + "/?auth=failed");
      }
    }
    if (action === "logout") {
      if (req.headers.origin !== cfg.origin)
        return json(403, { error: "같은 대시보드에서 연결을 해제해 주세요." });
      res.setHeader("Set-Cookie", [
        setCookie(SESSION, "", 0, cfg),
        setCookie(FLOW, "", 0, cfg),
      ]);
      let revoked = true;
      if (owner) {
        try {
          await client().revokeToken(session.token);
        } catch {
          revoked = false;
        }
      }
      return json(200, { connected: false, revoked });
    }
    if (!owner)
      return json(401, { error: "Google 로그인이 필요하거나 만료됐습니다." });
    const bounds = dayBounds(url.searchParams.get("date"));
    if (!bounds) return json(400, { error: "올바른 날짜를 선택해 주세요." });
    try {
      const events = [];
      let pageToken;
      do {
        const endpoint = new URL(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        );
        endpoint.search = new URLSearchParams({
          timeMin: bounds.start,
          timeMax: bounds.end,
          timeZone: "Asia/Seoul",
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
          ...(pageToken ? { pageToken } : {}),
        }).toString();
        const response = await fetcher(endpoint, {
          headers: { Authorization: `Bearer ${session.token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401) {
          res.setHeader("Set-Cookie", [setCookie(SESSION, "", 0, cfg)]);
          return json(401, {
            error: "Google 로그인이 만료됐습니다. 다시 연결해 주세요.",
          });
        }
        if (!response.ok) throw Error("Calendar request failed");
        const data = await response.json();
        for (const e of data.items ?? []) {
          if (e.status !== "cancelled")
            events.push({
              id: e.id,
              title: e.summary ?? "(제목 없음)",
              start: e.start?.dateTime ?? e.start?.date,
              end: e.end?.dateTime ?? e.end?.date,
              allDay: !!e.start?.date,
            });
        }
        pageToken = data.nextPageToken;
        if (events.length >= 1000 && pageToken)
          return json(422, {
            error:
              "이날 일정이 너무 많습니다. Google 캘린더에서 확인해 주세요.",
          });
      } while (pageToken);
      return json(200, {
        date: url.searchParams.get("date"),
        timeZone: "Asia/Seoul",
        events,
      });
    } catch {
      return json(502, {
        error: "일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }
  };
}
