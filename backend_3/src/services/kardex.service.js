const { query, TABLE, getClient } = require('../config/database');
const AppError = require('../utils/AppError');

async function getAllKardex(filtros = {}) {
  const { producto_id, tipo_movimiento, fecha_desde, fecha_hasta, referencia_tipo } = filtros;

  const conditions = ['1 = 1'];
  const params = [];
  let paramIndex = 1;

  if (producto_id) {
    conditions.push(`k.producto_id = $${paramIndex}`);
    params.push(producto_id);
    paramIndex++;
  }

  if (tipo_movimiento) {
    conditions.push(`k.tipo_movimiento = $${paramIndex}`);
    params.push(tipo_movimiento);
    paramIndex++;
  }

  if (fecha_desde) {
    conditions.push(`k.created_at >= $${paramIndex}`);
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    conditions.push(`k.created_at <= $${paramIndex}`);
    params.push(fecha_hasta);
    paramIndex++;
  }

  if (referencia_tipo) {
    conditions.push(`k.referencia_tipo = $${paramIndex}`);
    params.push(referencia_tipo);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT k.*,
            p.nombre AS producto_nombre,
            p.unidad_medida,
            u.nombre AS usuario_nombre,
            (SELECT referencia FROM inventario.kardex WHERE id = k.reversion_de) AS reversion_de_nombre
     FROM inventario.kardex k
     JOIN inventario.productos p ON p.id = k.producto_id
     LEFT JOIN pos.usuarios u ON u.id = k.usuario_id
     WHERE ${whereClause}
     ORDER BY k.created_at DESC`,
    params
  );

  return result.rows;
}

async function getKardexById(id) {
  const result = await query(
    `SELECT k.*,
            p.nombre AS producto_nombre,
            p.unidad_medida,
            u.nombre AS usuario_nombre,
            orig.tipo_movimiento AS original_tipo,
            orig.cantidad AS original_cantidad,
            orig.created_at AS original_fecha
     FROM inventario.kardex k
     JOIN inventario.productos p ON p.id = k.producto_id
     LEFT JOIN pos.usuarios u ON u.id = k.usuario_id
     LEFT JOIN inventario.kardex orig ON orig.id = k.reversion_de
     WHERE k.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Movimiento de kardex no encontrado');
  }

  return result.rows[0];
}

async function getKardexPorProducto(producto_id, limite = 100) {
  const result = await query(
    `SELECT k.*,
            p.nombre AS producto_nombre,
            p.unidad_medida,
            u.nombre AS usuario_nombre
     FROM inventario.kardex k
     JOIN inventario.productos p ON p.id = k.producto_id
     LEFT JOIN pos.usuarios u ON u.id = k.usuario_id
     WHERE k.producto_id = $1
     ORDER BY k.created_at DESC
     LIMIT $2`,
    [producto_id, limite]
  );

  return result.rows;
}

async function revertirMovimiento(kardex_id, usuario_id, motivo) {
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
    throw AppError.forbidden('Solo administradores pueden revertir movimientos de kardex');
  }

  const movimiento = await query(
    `SELECT id, tipo_movimiento, reversion_de FROM inventario.kardex WHERE id = $1`,
    [kardex_id]
  );

  if (movimiento.rows.length === 0) {
    throw AppError.notFound('Movimiento de kardex no encontrado');
  }

  if (movimiento.rows[0].reversion_de !== null) {
    throw AppError.conflict('Este movimiento ya es una reversión, no se puede revertir de nuevo');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT inventario.fn_revertir_kardex($1, $2, $3) AS nuevo_kardex_id`,
      [kardex_id, usuario_id, motivo || 'Reversión manual']
    );

    const nuevoKardexId = result.rows[0].nuevo_kardex_id;

    await client.query('COMMIT');

    return await getKardexById(nuevoKardexId);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error revertiendo movimiento de kardex:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function getResumenKardex(fecha_desde, fecha_hasta) {
  const result = await query(
    `SELECT 
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            p.unidad_medida,
            p.stock_actual,
            p.stock_minimo,
            -- AÑADIDOS LOS NUEVOS TIPOS DE ENTRADA
            COALESCE(SUM(CASE WHEN k.tipo_movimiento IN ('compra', 'ajuste', 'ajuste_entrada', 'reversion') THEN k.cantidad ELSE 0 END), 0) AS total_entradas,
            -- AÑADIDOS LOS NUEVOS TIPOS DE SALIDA
            COALESCE(SUM(CASE WHEN k.tipo_movimiento IN ('venta', 'salida_cocina', 'merma', 'ajuste_salida') THEN k.cantidad ELSE 0 END), 0) AS total_salidas,
            COUNT(k.id) AS total_movimientos
     FROM inventario.productos p
     LEFT JOIN inventario.kardex k ON k.producto_id = p.id
       AND k.created_at >= $1
       AND k.created_at <= $2
     WHERE p.control_stock = TRUE AND p.activo = TRUE
     GROUP BY p.id, p.nombre, p.unidad_medida, p.stock_actual, p.stock_minimo
     ORDER BY total_movimientos DESC`,
    [fecha_desde, fecha_hasta]
  );

  return result.rows;
}

async function getValorizacionInventario() {
  const result = await query(
    `SELECT 
            p.id,
            p.nombre,
            p.tipo,
            c.nombre AS categoria,
            p.stock_actual,
            p.costo_promedio,
            -- CÁLCULO PRECISO A 4 DECIMALES PARA LA VALORIZACIÓN
            ROUND((p.stock_actual * p.costo_promedio), 4) AS valor_total,
            p.unidad_medida
     FROM inventario.productos p
     JOIN inventario.categorias c ON c.id = p.categoria_id
     WHERE p.control_stock = TRUE AND p.activo = TRUE
     ORDER BY valor_total DESC`
  );

  const totalGeneral = result.rows.reduce((sum, row) => sum + parseFloat(row.valor_total), 0);

  return {
    productos: result.rows,
    total_general: totalGeneral.toFixed(4),
  };
}

module.exports = {
  getAllKardex,
  getKardexById,
  getKardexPorProducto,
  revertirMovimiento,
  getResumenKardex,
  getValorizacionInventario,
};