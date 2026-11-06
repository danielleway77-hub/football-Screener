import { normalizePercent } from "./percent";
import { ingestPayloadSchema, parseRawMatch } from "./schema";
import type { InvalidItem, NormalizedPayload, RawMatchInput } from "./types";

export { normalizePercent };
export type { PercentResult } from "./percent";

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}

const idOf = (raw: unknown): string | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const id = (raw as { providerMatchId?: unknown }).providerMatchId;
  return typeof id === "string" || typeof id === "number" ? String(id).slice(0, 64) : undefined;
};

/**
 * Validates a whole payload item by item. Bad items never reject the batch: they come back in
 * `invalid` with a human sentence. Duplicate provider+id pairs: the LAST one wins, earlier ones are
 * dropped and counted in `duplicates`. Throws `PayloadError` only when the payload itself is unusable
 * (not an object, no `matches` array, empty, or more than 500 items).
 */
export function normalizePayload(payload: unknown): NormalizedPayload {
  const top = ingestPayloadSchema.safeParse(payload);
  if (!top.success) throw new PayloadError(top.error.issues[0]!.message);
  const { matches, percentScale } = top.data;

  const invalid: InvalidItem[] = [];
  const byKey = new Map<string, { item: RawMatchInput; index: number }>();
  let duplicates = 0;

  matches.forEach((raw, index) => {
    const parsed = parseRawMatch(raw, percentScale ?? "percent");
    if (!parsed.ok) {
      invalid.push({ index, id: idOf(raw), reason: parsed.reason });
      return;
    }
    const key = `${parsed.value.provider}\u0000${parsed.value.providerMatchId}`;
    if (byKey.has(key)) {
      duplicates += 1;
      byKey.delete(key); // keep the LAST occurrence, at its own position
    }
    byKey.set(key, { item: parsed.value, index });
  });

  const ordered = [...byKey.values()].sort((a, b) => a.index - b.index);
  return {
    valid: ordered.map((e) => e.item),
    validIndexes: ordered.map((e) => e.index),
    invalid,
    duplicates,
  };
}
