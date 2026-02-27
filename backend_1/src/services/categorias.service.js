const pool = require('../config/db');

class CategoriasService {
  async obtenerTodas() {
    const result = await pool.query(
      'SELECT * FROM categorias WHERE activo = true ORDER BY orden_mostrar, id'
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      'SELECT * FROM categorias WHERE id = $1 AND activo = true',
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Categoría no encontrada');
    }
    return result.rows[0];
  }

  async crear({ nombre, descripcion, orden_mostrar }) {
    const existe = await pool.query(
      'SELECT id FROM categorias WHERE nombre = $1 AND activo = true',
      [nombre]
    );

    if (existe.rows.length > 0) {
      throw new Error('Ya existe una categoría con ese nombre');
    }

    const result = await pool.query(
      `INSERT INTO categorias (nombre, descripcion, orden_mostrar, activo) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, descripcion || null, orden_mostrar || 0, true]
    );
    return result.rows[0];
  }

  async actualizar(id, { nombre, descripcion, orden_mostrar }) {
    const result = await pool.query(
      `UPDATE categorias 
       SET nombre = COALESCE($1, nombre), 
           descripcion = COALESCE($2, descripcion), 
           orden_mostrar = COALESCE($3, orden_mostrar)
       WHERE id = $4 AND activo = true 
       RETURNING *`,
      [nombre, descripcion, orden_mostrar, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Categoría no encontrada');
    }
    return result.rows[0];
  }

  async eliminar(id) {
    // Verificar si tiene productos asociados
    const productos = await pool.query(
      'SELECT COUNT(*) as count FROM productos WHERE categoria_id = $1 AND activo = true',
      [id]
    );

    if (parseInt(productos.rows[0].count) > 0) {
      throw new Error('No se puede eliminar. La categoría tiene productos asociados.');
    }

    const result = await pool.query(
      'UPDATE categorias SET activo = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Categoría no encontrada');
    }
    return result.rows[0];
  }
}

module.exports = new CategoriasService();