const AppError = require('../utils/AppError');

const ROLES = {
  ADMINISTRADOR: 'administrador',
  CAJERO: 'cajero',
  MESERO: 'mesero',
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Usuario no autenticado'));
    }

    if (!roles.includes(req.user.rol)) {
      return next(AppError.forbidden(`Acceso denegado. Roles permitidos: ${roles.join(', ')}`));
    }

    next();
  };
};

module.exports = { requireRole, ROLES };