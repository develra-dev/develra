export type DevelraErrorCode = 1 | 2 | 3 | 4 | 5;

export class DevelraError extends Error {
  public constructor(
    message: string,
    public readonly exitCode: DevelraErrorCode,
    public readonly diagnosticCode: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DevelraError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
