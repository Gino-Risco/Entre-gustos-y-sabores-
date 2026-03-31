const jwt = require('jsonwebtoken');
const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(AppError.unauthorized('Token no proporcionado'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT u.id, u.usuario, u.nombre, u.rol_id, r.nombre AS rol
       FROM ${TABLE.USUARIOS} u
       JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
       WHERE u.id = $1 AND u.activo = TRUE AND r.activo = TRUE`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return next(AppError.unauthorized('Usuario no encontrado o inactivo'));
    }

    req.user = {
      id: result.rows[0].id,
      usuario: result.rows[0].usuario,
      nombre: result.rows[0].nombre,
      rol: result.rows[0].rol,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(AppError.unauthorized('Token inválido'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Token expirado'));
    }
    next(error);
  }
};

module.exports = authenticate;