class AppError extends Error {
  constructor(message, statusCode, code = 'APPLICATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Solicitud inválida') {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static unauthorized(message = 'No autorizado') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Acceso denegado') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Conflicto de recursos') {
    return new AppError(message, 409, 'CONFLICT');
  }

  static internal(message = 'Error interno del servidor') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

module.exports = AppError;