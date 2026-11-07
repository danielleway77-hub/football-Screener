/**
 * Production smoke test. `pnpm prod:smoke` checks a RUNNING server (BASE_URL, default http://localhost:3017).
 * Works against `pnpm start` locally and against the real Vercel URL after deploy. Exits 1 on any failure.
 *
 * Optional inputs (process env only, never stored):
 *   SMOKE_PASSWORD  the app password -> also checks the login cookie flags and the signed-in /api/health
 *   CRON_SECRET     the cron secret  -> also checks the cron endpoint accepts it (THIS TRIGGERS A REAL RUN)
 *   EXPECT_HTTPS=1  fail unless BASE_URL is https (set it for the real URL)
 * Without the optional values those checks are reported as SKIP, never as a pass.
 */
const base = (process.env.BASE_URL ?? "http://localhost:3017").replace(/\/$/, "");
const isHttps = base.startsWith("https://");

type Result = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };
const results: Result[] = [];
const record = (name: string, ok: boolean, detail = "") =>
  results.push({ name, status: ok ? "PASS" : "FAIL", detail });
const skip = (name: string, detail: string) => results.push({ name, status: "SKIP", detail });

const get = (path: string, init: RequestInit = {}) =>
  fetch(base + path, { redirect: "manual", ...init });

const REQUIRED_HEADERS: Record<string, RegExp> = {
  "x-content-type-options": /^nosniff$/i,
  "x-frame-options": /^deny$/i,
  "referrer-policy": /.+/,
  "permissions-policy": /.+/,
  "content-security-policy": /frame-ancestors 'none'/,
};

function checkHeaders(label: string, res: Response) {
  const missing = Object.entries(REQUIRED_HEADERS)
    .filter(([name, re]) => !re.test(res.headers.get(name) ?? ""))
    .map(([name]) => name);
  record(`security headers on ${label}`, missing.length === 0, missing.join(", "));
  if (isHttps) {
    record(
      `HSTS on ${label}`,
      /max-age=\d+/.test(res.headers.get("strict-transport-security") ?? ""),
    );
  }
}

async function main() {
  if (process.env.EXPECT_HTTPS === "1") record("BASE_URL is https", isHttps, base);

  const root = await get("/");
  const loc = root.headers.get("location") ?? "";
  record(
    "/ redirects to /login",
    [302, 303, 307, 308].includes(root.status) && /\/login/.test(loc),
    `${root.status} -> ${loc}`,
  );

  const login = await get("/login");
  record("/login renders", login.status === 200, String(login.status));
  checkHeaders("page (/login)", login);

  // Health shape: exactly { ok, db } for anonymous callers, nothing else.
  const health = await get("/api/health");
  const body = (await health.json().catch(() => null)) as Record<string, unknown> | null;
  const keys = body ? Object.keys(body).sort().join(",") : "";
  record(
    "/api/health shape {ok,db} only",
    health.status === 200 && keys === "db,ok" && body?.ok === true && body?.db === true,
    `${health.status} keys=${keys}`,
  );
  checkHeaders("API (/api/health)", health);

  // Dev-only routes must not exist in production.
  for (const p of ["/style-guide", "/style-guide/match", "/style-guide/shell"]) {
    const r = await get(p);
    record(`${p} is 404 in production`, r.status === 404, String(r.status));
  }

  const robots = await get("/robots.txt");
  const robotsText = await robots.text();
  record(
    "robots.txt disallows all",
    robots.status === 200 && /Disallow:\s*\/\s*$/m.test(robotsText),
    String(robots.status),
  );
  const manifest = await get("/manifest.webmanifest");
  const manifestJson = (await manifest.json().catch(() => null)) as { name?: string } | null;
  record(
    "manifest public and valid",
    manifest.status === 200 && Boolean(manifestJson?.name),
    String(manifest.status),
  );
  for (const p of ["/opengraph-image.png", "/icon.svg"]) {
    const r = await get(p);
    const ct = r.headers.get("content-type") ?? "";
    record(`${p} public image`, r.status === 200 && /^image\//.test(ct), `${r.status} ${ct}`);
  }

  const runs = await get("/api/runs");
  record("signed-out /api/runs is 401", runs.status === 401, String(runs.status));

  const noAuth = await get("/api/cron/daily");
  record("cron 401 without secret", noAuth.status === 401, String(noAuth.status));
  const wrong = await get("/api/cron/daily", {
    headers: { authorization: "Bearer wrong-wrong-wrong" },
  });
  record("cron 401 with wrong secret", wrong.status === 401, String(wrong.status));
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const ok = await get("/api/cron/daily", {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    const j = (await ok.json().catch(() => null)) as { status?: string } | null;
    record(
      "cron accepts the secret (real run)",
      ok.status === 200 && Boolean(j?.status),
      `${ok.status} status=${j?.status}`,
    );
  } else skip("cron accepts the secret", "set CRON_SECRET to run (creates a real run)");

  const password = process.env.SMOKE_PASSWORD;
  if (!password) {
    skip("login cookie flags", "set SMOKE_PASSWORD");
  } else {
    const origin = new URL(base).origin;
    const res = await fetch(base + "/api/auth/login", {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ password }),
    });
    const session = res.headers.getSetCookie().find((c) => /^(__Host-)?session=/.test(c)) ?? "";
    record("login succeeds (204)", res.status === 204, String(res.status));
    record(
      "cookie named __Host-session",
      session.startsWith("__Host-session="),
      session.split("=")[0],
    );
    record("cookie HttpOnly", /;\s*HttpOnly/i.test(session));
    record("cookie SameSite=Lax", /;\s*SameSite=Lax/i.test(session));
    record("cookie Secure", /;\s*Secure/i.test(session));
    record(
      "cookie Path=/ and no Domain (__Host- rules)",
      /;\s*Path=\//i.test(session) && !/;\s*Domain=/i.test(session),
    );
    if (!isHttps) {
      skip(
        "browser keeps the Secure cookie",
        "plain http://localhost: some browsers drop it; confirm in DevTools on the https URL",
      );
    }
    const pair = session.split(";")[0];
    if (pair) {
      const authed = await get("/api/health", { headers: { cookie: pair } });
      const aj = (await authed.json().catch(() => ({}))) as Record<string, unknown>;
      record(
        "signed-in /api/health adds lastRunAt/lastStatus",
        "lastRunAt" in aj && "lastStatus" in aj,
        Object.keys(aj).join(","),
      );
      const home = await get("/", { headers: { cookie: pair } });
      record("signed-in / renders (200)", home.status === 200, String(home.status));
      checkHeaders("signed-in page (/)", home);
    }
    const bad = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ password: "definitely-not-the-password" }),
    });
    record(
      "wrong password is 401 or 429",
      bad.status === 401 || bad.status === 429,
      String(bad.status),
    );
  }
}

main()
  .catch((e) => record("smoke run completed", false, e instanceof Error ? e.message : String(e)))
  .finally(() => {
    process.stdout.write(`prod-smoke against ${base}\n`);
    for (const r of results) {
      process.stdout.write(
        `${r.status.padEnd(4)}  ${r.name}${r.detail ? `  (${r.detail})` : ""}\n`,
      );
    }
    const fail = results.filter((r) => r.status === "FAIL").length;
    const pass = results.filter((r) => r.status === "PASS").length;
    const skipped = results.filter((r) => r.status === "SKIP").length;
    process.stdout.write(`\n${pass} passed, ${fail} failed, ${skipped} skipped\n`);
    process.exit(fail > 0 ? 1 : 0);
  });
