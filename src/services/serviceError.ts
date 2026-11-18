// An error whose message is safe to show to the user as is.
export class ServiceError extends Error {}

export function fail(error: unknown, message: string): ServiceError {
  console.error(message, error)
  return new ServiceError(message)
}

// Errors raised by the database functions carry a short name (for example "user_not_found").
// Each service passes the messages that apply to it; anything else gets the fallback.
export function databaseError(
  error: { message: string },
  fallback: string,
  messages: Record<string, string>,
): ServiceError {
  const known = messages[error.message] ?? (error.message === 'not_allowed' ? 'You don’t have permission to do that.' : undefined)
  return known ? new ServiceError(known) : fail(error, fallback)
}

export function userMessage(error: unknown): string {
  return error instanceof ServiceError ? error.message : 'Something went wrong. Please try again.'
}
