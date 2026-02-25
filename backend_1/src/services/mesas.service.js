const pool = require('../config/db');

class MesasService {
  async obtenerTodas() {
    const result = await pool.query(
      'SELECT * FROM mesas WHERE activo = true ORDER BY id'
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      'SELECT * FROM mesas WHERE id = $1 AND activo = true',
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Mesa no encontrada');
    }
    return result.rows[0];
  }

  async crear({ nombre, capacidad, ubicacion }) {
    // Verificar que no exista nombre duplicado
    const existe = await pool.query(
      'SELECT id FROM mesas WHERE nombre = $1 AND activo = true',
      [nombre]
    );

    if (existe.rows.length > 0) {
      throw new Error('Ya existe una mesa con ese nombre');
    }

    const result = await pool.query(
      `INSERT INTO mesas (nombre, capacidad, ubicacion, estado, activo) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, capacidad, ubicacion, 'libre', true]
    );
    return result.rows[0];
  }

  async actualizar(id, { nombre, capacidad, ubicacion }) {
    const result = await pool.query(
      `UPDATE mesas 
       SET nombre = COALESCE($1, nombre), 
           capacidad = COALESCE($2, capacidad), 
           ubicacion = COALESCE($3, ubicacion)
       WHERE id = $4 AND activo = true 
       RETURNING *`,
      [nombre, capacidad, ubicacion, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Mesa no encontrada');
    }
    return result.rows[0];
  }

  async actualizarEstado(id, estado) {
    const estadosValidos = ['libre', 'ocupada', 'sucia', 'reservada', 'mantenimiento'];
    
    if (!estadosValidos.includes(estado)) {
      throw new Error(`Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`);
    }

    const result = await pool.query(
      'UPDATE mesas SET estado = $1 WHERE id = $2 AND activo = true RETURNING *',
      [estado, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Mesa no encontrada');
    }
    return result.rows[0];
  }

  async eliminar(id) {
    const result = await pool.query(
      'UPDATE mesas SET activo = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Mesa no encontrada');
    }
    return result.rows[0];
  }

  async obtenerDisponibles() {
    const result = await pool.query(
      "SELECT * FROM mesas WHERE estado = 'libre' AND activo = true ORDER BY id"
    );
    return result.rows;
  }
}

module.exports = new MesasService();