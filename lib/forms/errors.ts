export class FormServiceError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 | 403 = 400,
  ) {
    super(message);
    this.name = "FormServiceError";
  }
}

export class DraftConflictError extends FormServiceError {
  constructor(public currentRevision: number) {
    super("This draft changed in another session. Reload the latest version.", 409);
    this.name = "DraftConflictError";
  }
}

export class SchemaParseError extends FormServiceError {
  constructor(public issues: Array<{ path: string; message: string }>) {
    super(issues[0]?.message || "This onboarding schema is invalid.");
    this.name = "SchemaParseError";
  }
}
