const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

async function login(usuario, password) {
  // Buscar usuario con rol
  const result = await query(
    `SELECT u.id, u.usuario, u.nombre, u.password, u.rol_id, r.nombre AS rol
     FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.usuario = $1 AND u.activo = TRUE AND r.activo = TRUE`,
    [usuario]
  );

  if (result.rows.length === 0) {
    throw AppError.unauthorized('Usuario o contraseña incorrectos');
  }

  const user = result.rows[0];

  // Verificar password (bcrypt)
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw AppError.unauthorized('Usuario o contraseña incorrectos');
  }

  // Generar JWT
  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
    },
  };
}

async function getUserById(id) {
  const result = await query(
    `SELECT u.id, u.usuario, u.nombre, u.rol_id, r.nombre AS rol
     FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Usuario no encontrado');
  }

  return result.rows[0];
}

module.exports = { login, getUserById };