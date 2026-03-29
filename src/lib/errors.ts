export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    public readonly code: string = "API_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}
