import { z } from "zod";
import { AppError } from "@/server/errors";
import { handle, json, parseJson, readLimitedText, requireOwner } from "@/server/http";
import { createToken, listTokens } from "@/server/services/token-service";

const bodySchema = z.object({ label: z.string() });

export function GET(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: false });
    return json({ tokens: await listTokens() });
  });
}

/** Creates a token and returns its plaintext ONCE as {id, label, token}. */
export function POST(request: Request) {
  return handle(async () => {
    await requireOwner(request, { mutating: true });
    const parsed = bodySchema.safeParse(parseJson(await readLimitedText(request, 2048)));
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "Label must be 1–40 characters.", {
        label: "Label must be 1–40 characters.",
      });
    }
    return json(await createToken(parsed.data.label), 201);
  });
}
