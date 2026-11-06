import { isSameOrigin } from "@/server/auth/origin";
import { clearSession } from "@/server/auth/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Cross-origin request refused." } },
      { status: 403 },
    );
  }
  await clearSession();
  return new Response(null, { status: 204 });
}
