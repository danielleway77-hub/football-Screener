/** Error codes of the HTTP API (docs/ARCHITECTURE.md §7). */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "MODE_NOT_SUPPORTED"
  | "PROVIDER_NOT_CONFIGURED"
  | "RUN_IN_PROGRESS"
  | "NOT_FOUND"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  MODE_NOT_SUPPORTED: 409,
  PROVIDER_NOT_CONFIGURED: 503,
  RUN_IN_PROGRESS: 409,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

/** A failure with a stable code and a message that is safe to show to the user. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = fieldErrors;
  }
}

export function toErrorBody(error: AppError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
  };
}
