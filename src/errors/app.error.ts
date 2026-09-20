export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Credenciais inválidas") {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Email já cadastrado") {
    super(message, 409);
  }
}

