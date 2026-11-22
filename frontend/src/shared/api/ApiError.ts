export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
