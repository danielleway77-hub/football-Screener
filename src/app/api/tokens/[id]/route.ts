import { handle, noContent, requireOwner } from "@/server/http";
import { revokeToken } from "@/server/services/token-service";

/** Revokes a token (idempotent). */
export function DELETE(request: Request, ctx: RouteContext<"/api/tokens/[id]">) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    const { id } = await ctx.params;
    await revokeToken(id);
    return noContent();
  });
}
