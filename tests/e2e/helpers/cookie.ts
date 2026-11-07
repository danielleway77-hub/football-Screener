/** The session cookie name differs per build: `__Host-session` in production, `session` in dev (see jwt.ts). */
export const SESSION_COOKIE = process.env.PW_PROD === "1" ? "__Host-session" : "session";
