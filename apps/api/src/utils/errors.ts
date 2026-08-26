export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function fail(status: number, message: string, details?: unknown): never {
  throw new HttpError(status, message, details)
}
