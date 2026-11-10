/**
 * An error whose message is safe and friendly enough to show to a Discord user.
 * Anything that is NOT a UserFacingError is treated as unexpected: it is logged with
 * context and the user sees a generic "something went wrong" embed.
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly options: { title?: string; details?: string[] } = {},
  ) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** Raised when a template file is invalid. Message is multi-line and human readable. */
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

export function isUserFacing(error: unknown): error is UserFacingError {
  return error instanceof UserFacingError;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
