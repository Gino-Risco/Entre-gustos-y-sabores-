const { query, TABLE, getClient } = require('../config/database');
const AppError = require('../utils/AppError');

async function getAllSalidas(filtros = {}) {
  const { turno, aprobado, fecha_desde, fecha_hasta } = filtros;

  const conditions = ['sc.activo = TRUE'];
  const params = [];
  let paramIndex = 1;

  if (turno) {
    conditions.push(`sc.turno = $${paramIndex}`);
    params.push(turno);
    paramIndex++;
  }

  if (aprobado !== undefined) {
    conditions.push(`sc.aprobado = $${paramIndex}`);
    params.push(aprobado);
    paramIndex++;
  }

  if (fecha_desde) {
    conditions.push(`sc.created_at >= $${paramIndex}`);
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    conditions.push(`sc.created_at <= $${paramIndex}`);
    params.push(fecha_hasta);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT sc.*, u.nombre AS usuario_nombre, 
            (SELECT nombre FROM pos.usuarios WHERE id = sc.aprobado_por) AS aprobado_por_nombre
     FROM ${TABLE.SALIDAS_COCINA} sc
     JOIN pos.usuarios u ON u.id = sc.usuario_id
     WHERE ${whereClause}
     ORDER BY sc.created_at DESC`,
    params
  );

  return result.rows;
}

async function getSalidaById(id) {
  const result = await query(
    `SELECT sc.*, u.nombre AS usuario_nombre,
            (SELECT nombre FROM pos.usuarios WHERE id = sc.aprobado_por) AS aprobado_por_nombre
     FROM ${TABLE.SALIDAS_COCINA} sc
     JOIN pos.usuarios u ON u.id = sc.usuario_id
     WHERE sc.id = $1 AND sc.activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Salida de cocina no encontrada');
  }

  // Obtener detalles de la salida
  const detalles = await query(
    `SELECT scd.*, p.nombre AS producto_nombre, p.unidad_medida
     FROM ${TABLE.SALIDAS_COCINA_DETALLE} scd
     JOIN ${TABLE.PRODUCTOS} p ON p.id = scd.producto_id
     WHERE scd.salida_id = $1 AND scd.activo = TRUE
     ORDER BY scd.created_at ASC`,
    [id]
  );

  return {
    ...result.rows[0],
    detalles: detalles.rows,
  };
}

async function crearSalida(data, usuario_id) {
  const { turno, detalles, observaciones } = data;

  // Validar que el usuario es administrador
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
    throw AppError.forbidden('Solo administradores pueden registrar salidas de cocina');
  }

  // Validar turno
  const turnosValidos = ['manana', 'tarde', 'noche'];
  if (turno && !turnosValidos.includes(turno)) {
    throw AppError.badRequest(`Turno inválido. Válidos: ${turnosValidos.join(', ')}`);
  }

  // Validar detalles
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw AppError.badRequest('Debe proporcionar al menos un detalle de salida');
  }

  // Validar productos (deben ser insumos con control_stock = TRUE)
  const productoIds = detalles.map(d => d.producto_id);
  const productosResult = await query(
    `SELECT id, nombre, tipo, control_stock, unidad_medida 
     FROM ${TABLE.PRODUCTOS} 
     WHERE id = ANY($1) AND activo = TRUE`,
    [productoIds]
  );

  if (productosResult.rows.length !== productoIds.length) {
    throw AppError.badRequest('Uno o más productos no existen o están inactivos');
  }

  // Validar que todos los productos sean insumos con control de stock
  const productosMap = {};
  productosResult.rows.forEach(p => {
    productosMap[p.id] = p;
    
    if (p.tipo !== 'insumo' && p.control_stock !== true) {
      throw AppError.badRequest(
        `El producto "${p.nombre}" no es un insumo con control de stock. 
         Solo se pueden registrar salidas de cocina para insumos.`
      );
    }
  });

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Crear salida de cocina (aprobado = FALSE por defecto, NO descuenta stock aún)
    const salidaResult = await client.query(
      `INSERT INTO ${TABLE.SALIDAS_COCINA} 
       (usuario_id, turno, observaciones, aprobado, activo)
       VALUES ($1, $2, $3, FALSE, TRUE)
       RETURNING *`,
      [usuario_id, turno || 'manana', observaciones || null]
    );

    const salida = salidaResult.rows[0];

    // 2. Crear detalles de la salida
    for (const detalle of detalles) {
      await client.query(
        `INSERT INTO ${TABLE.SALIDAS_COCINA_DETALLE} 
         (salida_id, producto_id, cantidad, observaciones, activo)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [
          salida.id,
          detalle.producto_id,
          detalle.cantidad,
          detalle.observaciones || null,
        ]
      );
      // NOTA: El trigger NO descuenta stock aquí porque aprobado = FALSE
      // El descuento ocurre solo cuando se aprueba la salida
    }

    await client.query('COMMIT');

    return await getSalidaById(salida.id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando salida de cocina:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function aprobarSalida(id, usuario_id) {
  // Validar que el usuario es administrador
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
    throw AppError.forbidden('Solo administradores pueden aprobar salidas de cocina');
  }

  // Validar que la salida existe y no está aprobada
  const salida = await query(
    `SELECT id, aprobado, aprobado_por FROM ${TABLE.SALIDAS_COCINA} 
     WHERE id = $1 AND activo = TRUE`,
    [id]
  );

  if (salida.rows.length === 0) {
    throw AppError.notFound('Salida de cocina no encontrada');
  }

  if (salida.rows[0].aprobado === true) {
    throw AppError.conflict('Esta salida de cocina ya está aprobada');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 3. Aprobar salida (el trigger automáticamente descuenta stock en kardex)
    const result = await client.query(
      `UPDATE ${TABLE.SALIDAS_COCINA} 
       SET aprobado = TRUE, 
           aprobado_por = $1, 
           fecha_aprobacion = NOW(), 
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [usuario_id, id]
    );

    await client.query('COMMIT');

    return await getSalidaById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error aprobando salida de cocina:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function revertirAprobacion(id, usuario_id, motivo) {
  // Validar que el usuario es administrador
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
    throw AppError.forbidden('Solo administradores pueden revertir salidas de cocina');
  }

  // Validar que la salida existe y está aprobada
  const salida = await query(
    `SELECT id, aprobado FROM ${TABLE.SALIDAS_COCINA} 
     WHERE id = $1 AND activo = TRUE`,
    [id]
  );

  if (salida.rows.length === 0) {
    throw AppError.notFound('Salida de cocina no encontrada');
  }

  if (salida.rows[0].aprobado === false) {
    throw AppError.conflict('Esta salida de cocina no está aprobada');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Obtener movimientos de kardex generados por esta salida
    const kardexMovimientos = await client.query(
      `SELECT id, producto_id, cantidad FROM inventario.kardex 
       WHERE referencia_tipo = 'salida_cocina' AND referencia_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    // 2. Revertir cada movimiento de kardex
    for (const movimiento of kardexMovimientos.rows) {
      await client.query(
        `SELECT inventario.fn_revertir_kardex($1, $2, $3)`,
        [movimiento.id, usuario_id, `Reversión Salida Cocina #${id} - ${motivo || 'Sin motivo'}`]
      );
    }

    // 3. Marcar salida como inactiva (no se puede des-aprobar directamente)
    await client.query(
      `UPDATE ${TABLE.SALIDAS_COCINA} 
       SET activo = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // 4. Marcar detalles como inactivos
    await client.query(
      `UPDATE ${TABLE.SALIDAS_COCINA_DETALLE} 
       SET activo = FALSE
       WHERE salida_id = $1`,
      [id]
    );

    await client.query('COMMIT');

    return { success: true, message: 'Salida de cocina revertida correctamente' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error revertiendo salida de cocina:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function getSalidasPendientes() {
  const result = await query(
    `SELECT sc.*, u.nombre AS usuario_nombre,
            (SELECT COUNT(*) FROM ${TABLE.SALIDAS_COCINA_DETALLE} 
             WHERE salida_id = sc.id AND activo = TRUE) AS total_detalles
     FROM ${TABLE.SALIDAS_COCINA} sc
     JOIN pos.usuarios u ON u.id = sc.usuario_id
     WHERE sc.aprobado = FALSE AND sc.activo = TRUE
     ORDER BY sc.created_at DESC`
  );

  return result.rows;
}

module.exports = {
  getAllSalidas,
  getSalidaById,
  crearSalida,
  aprobarSalida,
  revertirAprobacion,
  getSalidasPendientes,
};