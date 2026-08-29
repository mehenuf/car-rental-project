// Domain-level error types. No server-only imports, no side effects — safe
// to import from queries.ts, route handlers, and the shared error handler
// alike without pulling in the service-role client.

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}
