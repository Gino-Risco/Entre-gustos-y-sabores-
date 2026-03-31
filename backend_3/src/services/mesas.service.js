const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

async function getAllMesas(filtros = {}) {
  const { estado, activo } = filtros;
  
  const conditions = ['m.activo = TRUE'];
  const params = [];
  let paramIndex = 1;

  if (estado) {
    conditions.push(`m.estado = $${paramIndex}`);
    params.push(estado);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT m.*, 
            (SELECT COUNT(*) FROM ${TABLE.ORDENES} o 
             WHERE o.mesa_id = m.id AND o.estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista') AND o.activo = TRUE) as ordenes_activas
     FROM ${TABLE.MESAS} m
     WHERE ${whereClause}
     ORDER BY m.numero ASC`,
    params
  );

  return result.rows;
}

async function getMesaById(id) {
  const result = await query(
    `SELECT m.*,
            (SELECT COUNT(*) FROM ${TABLE.ORDENES} o 
             WHERE o.mesa_id = m.id AND o.estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista') AND o.activo = TRUE) as ordenes_activas
     FROM ${TABLE.MESAS} m
     WHERE m.id = $1 AND m.activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Mesa no encontrada');
  }

  return result.rows[0];
}

async function getMesaByNumero(numero) {
  const result = await query(
    `SELECT * FROM ${TABLE.MESAS} WHERE numero = $1 AND activo = TRUE`,
    [numero]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Mesa no encontrada');
  }

  return result.rows[0];
}

async function createMesa(data) {
  const { numero, capacidad, ubicacion } = data;

  // Validar que no exista número duplicado
  const existing = await query(
    `SELECT id FROM ${TABLE.MESAS} WHERE numero = $1 AND activo = TRUE`,
    [numero]
  );

  if (existing.rows.length > 0) {
    throw AppError.conflict('Ya existe una mesa con ese número');
  }

  const result = await query(
    `INSERT INTO ${TABLE.MESAS} (numero, capacidad, ubicacion, estado, activo)
     VALUES ($1, $2, $3, 'libre', TRUE)
     RETURNING *`,
    [numero, capacidad || 4, ubicacion || null]
  );

  return result.rows[0];
}

async function updateMesa(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.keys(data).forEach((key) => {
    if (['id', 'created_at', 'updated_at'].includes(key)) return;
    fields.push(`${key} = $${paramIndex}`);
    values.push(data[key]);
    paramIndex++;
  });

  if (fields.length === 0) {
    throw AppError.badRequest('No hay campos para actualizar');
  }

  // Validar número único si se está cambiando
  if (data.numero) {
    const existing = await query(
      `SELECT id FROM ${TABLE.MESAS} WHERE numero = $1 AND id <> $2 AND activo = TRUE`,
      [data.numero, id]
    );

    if (existing.rows.length > 0) {
      throw AppError.conflict('Ya existe una mesa con ese número');
    }
  }

  // Validar que no se cambie estado si tiene orden activa
  if (data.estado) {
    const mesa = await getMesaById(id);
    if (mesa.ordenes_activas > 0 && data.estado === 'libre') {
      throw AppError.conflict('No se puede liberar la mesa: tiene una orden activa');
    }
  }

  values.push(id);
  
  const result = await query(
    `UPDATE ${TABLE.MESAS} 
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Mesa no encontrada');
  }

  return result.rows[0];
}

async function deleteMesa(id) {
  // Verificar si tiene órdenes asociadas
  const ordenes = await query(
    `SELECT COUNT(*) as count FROM ${TABLE.ORDENES} WHERE mesa_id = $1`,
    [id]
  );

  if (parseInt(ordenes.rows[0].count) > 0) {
    throw AppError.conflict('No se puede eliminar: la mesa tiene órdenes asociadas');
  }

  const result = await query(
    `UPDATE ${TABLE.MESAS} 
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Mesa no encontrada');
  }

  return { id };
}

async function updateEstadoMesa(id, estado) {
  const estadosValidos = ['libre', 'ocupada', 'reservada', 'mantenimiento'];
  
  if (!estadosValidos.includes(estado)) {
    throw AppError.badRequest(`Estado inválido. Estados permitidos: ${estadosValidos.join(', ')}`);
  }

  const mesa = await getMesaById(id);

  // Validaciones de estado
  if (estado === 'libre' && mesa.ordenes_activas > 0) {
    throw AppError.conflict('No se puede liberar la mesa: tiene una orden activa');
  }

  if (estado === 'ocupada' && mesa.estado === 'libre') {
    // Verificar que exista una orden abierta para esta mesa
    const ordenAbierta = await query(
      `SELECT id FROM ${TABLE.ORDENES} WHERE mesa_id = $1 AND estado = 'abierta' AND activo = TRUE`,
      [id]
    );
    
    if (ordenAbierta.rows.length === 0) {
      throw AppError.badRequest('No se puede ocupar la mesa: no tiene una orden abierta');
    }
  }

  const result = await query(
    `UPDATE ${TABLE.MESAS} 
     SET estado = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [estado, id]
  );

  return result.rows[0];
}

module.exports = {
  getAllMesas,
  getMesaById,
  getMesaByNumero,
  createMesa,
  updateMesa,
  deleteMesa,
  updateEstadoMesa,
};