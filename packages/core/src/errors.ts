import type { ErrorCode } from "./enums";
import { SCHEMA_VERSION } from "./versions";

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    schemaVersion: string;
  };
};

export class GrowthBaseError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "GrowthBaseError";
    this.code = code;
    this.details = details;
    this.status = status;
  }

  toEnvelope(): ErrorEnvelope {
    return createErrorEnvelope(this.code, this.message, this.details);
  }
}

export function createErrorEnvelope(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      details,
      schemaVersion: SCHEMA_VERSION
    }
  };
}
