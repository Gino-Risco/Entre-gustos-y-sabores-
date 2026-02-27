const pool = require('../config/db');
const bcrypt = require('bcryptjs');

class UsuariosService {
  async obtenerTodos() {
    const result = await pool.query(
      `SELECT id, nombre_completo, usuario, rol, activo, fecha_creacion, ultimo_acceso 
       FROM usuarios 
       ORDER BY id`
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      `SELECT id, nombre_completo, usuario, rol, activo, fecha_creacion, ultimo_acceso 
       FROM usuarios 
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    return result.rows[0];
  }

  async crear({ nombre_completo, usuario, password, rol }) {
    // Verificar que no exista el usuario
    const existe = await pool.query(
      'SELECT id FROM usuarios WHERE usuario = $1',
      [usuario]
    );

    if (existe.rows.length > 0) {
      throw new Error('Ya existe un usuario con ese nombre de usuario');
    }

    // Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (nombre_completo, usuario, password_hash, rol, password_hash_algorithm, activo) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre_completo, usuario, rol, activo, fecha_creacion`,
      [nombre_completo, usuario, passwordHash, rol, 'bcrypt', true]
    );
    return result.rows[0];
  }

  async actualizar(id, { nombre_completo, rol, activo }) {
    const result = await pool.query(
      `UPDATE usuarios 
       SET nombre_completo = COALESCE($1, nombre_completo), 
           rol = COALESCE($2, rol),
           activo = COALESCE($3, activo)
       WHERE id = $4 
       RETURNING id, nombre_completo, usuario, rol, activo`,
      [nombre_completo, rol, activo, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    return result.rows[0];
  }

  async actualizarPassword(id, password) {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2 RETURNING id',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    return { message: 'Contraseña actualizada correctamente' };
  }

  async eliminar(id) {
    // No permitir eliminarse a sí mismo
    if (id === 1) {
      throw new Error('No se puede eliminar el usuario administrador principal');
    }

    const result = await pool.query(
      'UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    return { message: 'Usuario desactivado correctamente' };
  }
}

module.exports = new UsuariosService();