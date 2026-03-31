const bcrypt = require('bcrypt');
const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

async function getAllUsuarios() {
  const result = await query(
    `SELECT u.id, u.nombre, u.usuario, u.correo, u.activo, u.rol_id, r.nombre as rol_nombre 
     FROM pos.usuarios u
     JOIN pos.roles r ON u.rol_id = r.id
     -- Quitamos el WHERE u.activo = TRUE para que traiga a todos
     ORDER BY u.activo DESC, u.nombre ASC` // Los activos salen primero
  );
  return result.rows;
}

async function getUsuarioById(id) {
  const result = await query(
    `SELECT u.id, u.nombre, u.usuario, u.correo, u.activo, u.rol_id, r.nombre as rol_nombre 
     FROM pos.usuarios u
     JOIN pos.roles r ON u.rol_id = r.id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [id]
  );
  
  if (result.rows.length === 0) throw AppError.notFound('Usuario no encontrado');
  return result.rows[0];
}

async function createUsuario(data) {
  const { nombre, usuario, password, correo, rol_id } = data;

  // 1. Verificar si el usuario ya existe
  const userExist = await query(`SELECT id FROM pos.usuarios WHERE usuario = $1`, [usuario]);
  if (userExist.rows.length > 0) throw AppError.conflict('El nombre de usuario ya está en uso');

  // 2. Verificar el correo (si se proporciona)
  if (correo) {
    const emailExist = await query(`SELECT id FROM pos.usuarios WHERE correo = $1`, [correo]);
    if (emailExist.rows.length > 0) throw AppError.conflict('El correo ya está registrado');
  }

  // 3. Encriptar la contraseña (Costo 12, como exige tu documentación de BD)
  // Esto generará un string de ~60 caracteres, pasando perfectamente tu restricción CHECK
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 4. Guardar en la base de datos
  const result = await query(
    `INSERT INTO pos.usuarios (nombre, usuario, password, correo, rol_id, activo)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id, nombre, usuario, correo, rol_id`,
    [nombre, usuario, passwordHash, correo || null, rol_id]
  );

  return result.rows[0];
}

async function updateUsuario(id, data) {
  const { nombre, usuario, password, correo, rol_id } = data;
  
  // Si cambia el usuario, verificar que no esté usado por otro
  if (usuario) {
    const userExist = await query(`SELECT id FROM pos.usuarios WHERE usuario = $1 AND id != $2`, [usuario, id]);
    if (userExist.rows.length > 0) throw AppError.conflict('El nombre de usuario ya está en uso');
  }

  // Si cambia el correo, verificar unicidad
  if (correo) {
    const emailExist = await query(`SELECT id FROM pos.usuarios WHERE correo = $1 AND id != $2`, [correo, id]);
    if (emailExist.rows.length > 0) throw AppError.conflict('El correo ya está registrado');
  }

  let queryStr = `UPDATE pos.usuarios SET nombre = $1, usuario = $2, correo = $3, rol_id = $4, updated_at = NOW()`;
  let params = [nombre, usuario, correo || null, rol_id];
  let paramIndex = 5;

  // Si el administrador decide cambiarle la contraseña al usuario
  if (password) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    queryStr += `, password = $${paramIndex}`;
    params.push(passwordHash);
    paramIndex++;
  }

  queryStr += ` WHERE id = $${paramIndex} RETURNING id, nombre, usuario, correo, rol_id`;
  params.push(id);

  const result = await query(queryStr, params);
  if (result.rows.length === 0) throw AppError.notFound('Usuario no encontrado');
  
  return result.rows[0];
}

async function deleteUsuario(id) {
  // Cambiamos 'activo = FALSE' por 'activo = NOT activo'
  const result = await query(
    `UPDATE pos.usuarios SET activo = NOT activo, updated_at = NOW() WHERE id = $1 RETURNING id, activo`,
    [id]
  );
  if (result.rows.length === 0) throw AppError.notFound('Usuario no encontrado');
  
  const mensaje = result.rows[0].activo ? 'Usuario reactivado correctamente' : 'Usuario inhabilitado correctamente';
  return { message: mensaje };
}

// ============================================================
// OBTENER ROLES (Para el select en el formulario de React)
// ============================================================
async function getAllRoles() {
  const result = await query(`SELECT id, nombre, descripcion FROM pos.roles WHERE activo = TRUE`);
  return result.rows;
}

module.exports = {
  getAllUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getAllRoles
};