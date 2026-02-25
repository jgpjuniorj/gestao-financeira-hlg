export class DatabaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'DatabaseError';
    if (options.cause) this.cause = options.cause;
    if (options.code) this.code = options.code;
    if (options.meta) this.meta = options.meta;
  }
}

export class NotFoundError extends DatabaseError {
  constructor(message, options = {}) {
    super(message || 'Recurso não encontrado.', { ...options, code: options.code || 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message, options = {}) {
    super(message || 'Dados inválidos.', { ...options, code: options.code || 'VALIDATION_ERROR' });
    this.name = 'ValidationError';
  }
}

export class ConflictError extends DatabaseError {
  constructor(message, options = {}) {
    super(message || 'Conflito de dados.', { ...options, code: options.code || 'CONFLICT' });
    this.name = 'ConflictError';
  }
}
