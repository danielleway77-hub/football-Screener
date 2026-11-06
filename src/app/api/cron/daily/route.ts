import { json } from "@/server/http";
import { isValidCronAuth, runDaily } from "@/server/services/cron-service";

// Hobby plan functions allow up to 60 s; the daily pull must finish inside it.
export const maxDuration = 60;

/**
 * Daily job, called by Vercel Cron (GET, with `Authorization: Bearer $CRON_SECRET` sent automatically) or by
 * `pnpm run:daily`. Public for the proxy (no session) but protected by its own secret.
 */
export async function GET(request: Request) {
  if (!isValidCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    console.warn("Cron request rejected: missing or wrong credentials");
    return json({ error: { code: "UNAUTHORIZED", message: "Unauthorized." } }, 401);
  }
  try {
    const result = await runDaily();
    // A FAILED run answers 500 so Vercel's cron log and `pnpm run:daily` show the failure.
    return json(result, result.status === "FAILED" ? 500 : 200);
  } catch (error) {
    console.error("Daily cron crashed", { name: error instanceof Error ? error.name : "unknown" });
    return json(
      { error: { code: "INTERNAL", message: "The daily job failed. See the logs." } },
      500,
    );
  }
}
