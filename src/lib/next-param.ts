/**
 * Validates the post-login redirect target. Only same-site absolute paths are allowed:
 * a single leading "/", never "//" (protocol-relative), "/\" (browsers treat backslash as slash),
 * a scheme, control characters, or anything else. Everything else becomes "/".
 */
export function sanitizeNext(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  return value;
}
