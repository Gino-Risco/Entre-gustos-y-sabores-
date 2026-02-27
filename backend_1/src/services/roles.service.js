const pool = require('../config/db');

class RolesService {
  async obtenerTodos() {
    const result = await pool.query(
      'SELECT * FROM roles WHERE activo = true ORDER BY id'
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      'SELECT * FROM roles WHERE id = $1 AND activo = true',
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Rol no encontrado');
    }
    return result.rows[0];
  }

  async crear({ nombre, descripcion }) {
    const existe = await pool.query(
      'SELECT id FROM roles WHERE nombre = $1',
      [nombre]
    );

    if (existe.rows.length > 0) {
      throw new Error('Ya existe un rol con ese nombre');
    }

    const result = await pool.query(
      `INSERT INTO roles (nombre, descripcion, activo) 
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre, descripcion || null, true]
    );
    return result.rows[0];
  }

  async actualizar(id, { nombre, descripcion }) {
    const result = await pool.query(
      `UPDATE roles 
       SET nombre = COALESCE($1, nombre), 
           descripcion = COALESCE($2, descripcion)
       WHERE id = $3 AND activo = true 
       RETURNING *`,
      [nombre, descripcion, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Rol no encontrado');
    }
    return result.rows[0];
  }

  async eliminar(id) {
    // No permitir eliminar roles con usuarios asignados
    const usuarios = await pool.query(
      'SELECT COUNT(*) as count FROM usuarios WHERE rol_id = $1 AND activo = true',
      [id]
    );

    if (parseInt(usuarios.rows[0].count) > 0) {
      throw new Error('No se puede eliminar. Hay usuarios con este rol asignado.');
    }

    const result = await pool.query(
      'UPDATE roles SET activo = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Rol no encontrado');
    }
    return result.rows[0];
  }
}

module.exports = new RolesService();