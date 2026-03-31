const AppError = require('../utils/AppError');

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';
  const code = err.code || 'INTERNAL_ERROR';

  console.error('Error:', { statusCode, message, path: req.path });

  res.status(statusCode).json({
    success: false,
    error: { message, code },
  });
};

module.exports = errorMiddleware;