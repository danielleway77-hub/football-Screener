/** Request correlation id: reuse a safe incoming `x-request-id`, otherwise mint a UUID. Edge-safe (no node imports). */
export const REQUEST_ID_HEADER = "x-request-id";
const VALID = /^[A-Za-z0-9._-]{8,64}$/;

export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && VALID.test(value);
}

export function resolveRequestId(incoming: string | null | undefined): string {
  return isValidRequestId(incoming) ? incoming : crypto.randomUUID();
}
