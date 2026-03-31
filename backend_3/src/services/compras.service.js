const { query, TABLE, getClient } = require('../config/database');
const AppError = require('../utils/AppError');

// ==========================================
// PROVEEDORES
// ==========================================

async function getAllProveedores(filtros = {}) {
  const { activo } = filtros;
  const conditions = ['p.activo = TRUE'];
  const params = [];
  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT * FROM ${TABLE.PROVEEDORES} p WHERE ${whereClause} ORDER BY p.nombre ASC`,
    params
  );
  return result.rows;
}

async function getProveedorById(id) {
  const result = await query(
    `SELECT * FROM ${TABLE.PROVEEDORES} WHERE id = $1 AND activo = TRUE`,
    [id]
  );
  if (result.rows.length === 0) {
    throw AppError.notFound('Proveedor no encontrado');
  }
  return result.rows[0];
}

async function createProveedor(data) {
  const { nombre, ruc, telefono, direccion, email, tipo_producto } = data;

  if (ruc) {
    const existing = await query(
      `SELECT id FROM ${TABLE.PROVEEDORES} WHERE ruc = $1 AND activo = TRUE`,
      [ruc]
    );
    if (existing.rows.length > 0) {
      throw AppError.conflict('Ya existe un proveedor con ese RUC');
    }
  }

  const result = await query(
    `INSERT INTO ${TABLE.PROVEEDORES} 
     (nombre, ruc, telefono, direccion, email, tipo_producto, activo)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING *`,
    [nombre, ruc || null, telefono || null, direccion || null, email || null, tipo_producto || null]
  );
  return result.rows[0];
}

async function updateProveedor(id, data) {
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

  if (data.ruc) {
    const existing = await query(
      `SELECT id FROM ${TABLE.PROVEEDORES} WHERE ruc = $1 AND id <> $2 AND activo = TRUE`,
      [data.ruc, id]
    );
    if (existing.rows.length > 0) {
      throw AppError.conflict('Ya existe un proveedor con ese RUC');
    }
  }

  values.push(id);
  const result = await query(
    `UPDATE ${TABLE.PROVEEDORES} 
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Proveedor no encontrado');
  }
  return result.rows[0];
}

async function deleteProveedor(id) {
  const compras = await query(
    `SELECT COUNT(*) as count FROM ${TABLE.COMPRAS} WHERE proveedor_id = $1 AND activo = TRUE`,
    [id]
  );

  if (parseInt(compras.rows[0].count) > 0) {
    throw AppError.conflict('No se puede eliminar: el proveedor tiene compras registradas');
  }

  const result = await query(
    `UPDATE ${TABLE.PROVEEDORES} 
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Proveedor no encontrado');
  }
  return { id };
}

// ==========================================
// COMPRAS
// ==========================================

async function getAllCompras(filtros = {}) {
  const { proveedor_id, fecha_desde, fecha_hasta, activo } = filtros;
  const conditions = ['c.activo = TRUE'];
  const params = [];
  let paramIndex = 1;

  if (proveedor_id) {
    conditions.push(`c.proveedor_id = $${paramIndex}`);
    params.push(proveedor_id);
    paramIndex++;
  }
  if (fecha_desde) {
    conditions.push(`c.created_at >= $${paramIndex}`);
    params.push(fecha_desde);
    paramIndex++;
  }
  if (fecha_hasta) {
    conditions.push(`c.created_at <= $${paramIndex}`);
    params.push(fecha_hasta);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const result = await query(
    `SELECT c.*, p.nombre AS proveedor_nombre, u.nombre AS usuario_nombre
     FROM ${TABLE.COMPRAS} c
     JOIN ${TABLE.PROVEEDORES} p ON p.id = c.proveedor_id
     JOIN pos.usuarios u ON u.id = c.usuario_id
     WHERE ${whereClause}
     ORDER BY c.created_at DESC`,
    params
  );
  return result.rows;
}

async function getCompraById(id) {
  const result = await query(
    `SELECT c.*, p.nombre AS proveedor_nombre, u.nombre AS usuario_nombre
     FROM ${TABLE.COMPRAS} c
     JOIN ${TABLE.PROVEEDORES} p ON p.id = c.proveedor_id
     JOIN pos.usuarios u ON u.id = c.usuario_id
     WHERE c.id = $1 AND c.activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Compra no encontrada');
  }

  const detalles = await query(
    `SELECT cd.*, pr.nombre AS producto_nombre, pr.unidad_medida
     FROM ${TABLE.COMPRAS_DETALLE} cd
     JOIN ${TABLE.PRODUCTOS} pr ON pr.id = cd.producto_id
     WHERE cd.compra_id = $1 AND cd.activo = TRUE
     ORDER BY cd.created_at ASC`,
    [id]
  );

  return {
    ...result.rows[0],
    detalles: detalles.rows,
  };
}

async function createCompra(data, usuario_id) {
  const {
    proveedor_id,
    fecha_emision,
    tipo_comprobante,
    serie_comprobante,
    numero_comprobante,
    igv,
    detalles,
    observaciones,
    metodo_pago
  } = data;

  const metodoPagoFinal = metodo_pago || 'efectivo';

  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
    throw AppError.forbidden('Solo administradores pueden registrar compras');
  }

  const proveedor = await query(
    `SELECT id, nombre FROM ${TABLE.PROVEEDORES} WHERE id = $1 AND activo = TRUE`,
    [proveedor_id]
  );
  if (proveedor.rows.length === 0) {
    throw AppError.notFound('Proveedor no encontrado');
  }
  const proveedorNombre = proveedor.rows[0].nombre;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw AppError.badRequest('Debe proporcionar al menos un detalle de compra');
  }

  const productoIds = detalles.map(d => d.producto_id);
  const productosResult = await query(
    `SELECT id, nombre, control_stock, unidad_medida FROM ${TABLE.PRODUCTOS} 
     WHERE id = ANY($1) AND activo = TRUE`,
    [productoIds]
  );

  if (productosResult.rows.length !== productoIds.length) {
    throw AppError.badRequest('Uno o más productos no existen o están inactivos');
  }

  let subtotal = 0;
  detalles.forEach(d => {
    subtotal += parseFloat(d.cantidad) * parseFloat(d.costo_unitario);
  });

  const igvCalculado = parseFloat(igv || 0);
  const totalFinal = subtotal + igvCalculado;

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Verificar Caja si es Efectivo
    let idCaja = null;
    if (metodoPagoFinal === 'efectivo') {
      const cajaAbierta = await client.query(
        `SELECT id FROM pos.caja_aperturas WHERE estado = 'abierta' AND activo = TRUE LIMIT 1`
      );
      if (cajaAbierta.rows.length === 0) {
        throw AppError.badRequest('Debe abrir caja antes de registrar compras en efectivo.');
      }
      idCaja = cajaAbierta.rows[0].id;
    }

    // 2. Insertar la Compra
    const compraResult = await client.query(
      `INSERT INTO ${TABLE.COMPRAS} 
       (proveedor_id, usuario_id, fecha_emision, tipo_comprobante, serie_comprobante, numero_comprobante, subtotal, igv, total, observaciones, metodo_pago, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
       RETURNING *`,
      [
        proveedor_id, usuario_id, fecha_emision || new Date(),
        tipo_comprobante || 'Nota de Venta', serie_comprobante || null,
        numero_comprobante || null, subtotal, igvCalculado, totalFinal,
        observaciones || null, metodoPagoFinal
      ]
    );
    const compra = compraResult.rows[0];

    // 3. Registrar el Egreso en Caja (si aplica)
    if (metodoPagoFinal === 'efectivo' && idCaja) {
      const descPago = `Pago Compra #${compra.id} - ${proveedorNombre}`;
      const egresoCaja = await client.query(
        `INSERT INTO pos.caja_movimientos 
         (caja_id, tipo, descripcion, monto, usuario_id, referencia_tipo, referencia_id, activo)
         VALUES ($1, 'gasto', $2, $3, $4, 'compra', $5, TRUE) RETURNING id`,
        [idCaja, descPago, totalFinal, usuario_id, compra.id]
      );

      await client.query(
        `UPDATE ${TABLE.COMPRAS} SET caja_movimiento_id = $1 WHERE id = $2`,
        [egresoCaja.rows[0].id, compra.id]
      );
    }

    // 4. Guardar Detalles y ACTUALIZAR COSTO PROMEDIO
    for (const detalle of detalles) {
      // a. LEER EL STOCK ANTES DE INSERTAR (Para que el Trigger no nos gane)
      const prodRes = await client.query(
        `SELECT stock_actual, costo_promedio FROM ${TABLE.PRODUCTOS} WHERE id = $1`,
        [detalle.producto_id]
      );

      const p = prodRes.rows[0];
      const stockAnterior = parseFloat(p.stock_actual) || 0;
      const costoAnterior = parseFloat(p.costo_promedio) || 0;
      const cantComprada = parseFloat(detalle.cantidad);
      const precioCompra = parseFloat(detalle.costo_unitario);

      // b. FÓRMULA DEL COSTO PROMEDIO PONDERADO
      let nuevoCostoPromedio = precioCompra;
      if (stockAnterior > 0) {
        nuevoCostoPromedio = ((stockAnterior * costoAnterior) + (cantComprada * precioCompra)) / (stockAnterior + cantComprada);
      }

      // c. INSERTAR EL DETALLE (Aquí el Trigger de PostgreSQL suma el stock real)
      await client.query(
        `INSERT INTO ${TABLE.COMPRAS_DETALLE} 
         (compra_id, producto_id, cantidad, costo_unitario, activo)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [compra.id, detalle.producto_id, detalle.cantidad, detalle.costo_unitario]
      );

      // d. ACTUALIZAR SOLO EL COSTO PROMEDIO
      await client.query(
        `UPDATE ${TABLE.PRODUCTOS} 
         SET costo_promedio = $1, updated_at = NOW() 
         WHERE id = $2`,
        [nuevoCostoPromedio, detalle.producto_id]
      );
    }


    await client.query('COMMIT');
    return await getCompraById(compra.id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en transacción de compra:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function anularCompra(id, usuario_id, motivo) {
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
    throw AppError.forbidden('Solo administradores pueden anular compras');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Obtener la información de la compra
    const compraInfoResult = await client.query(
      `SELECT caja_movimiento_id, total, metodo_pago FROM ${TABLE.COMPRAS} WHERE id = $1 AND activo = TRUE`,
      [id]
    );

    if (compraInfoResult.rows.length === 0) {
      throw AppError.notFound('Compra no encontrada o ya está anulada');
    }
    const compraInfo = compraInfoResult.rows[0];

    // 2. Revertir Detalles, Kardex, Stock y Costo Promedio
    // OJO: Añadí costo_unitario al SELECT para poder hacer la resta matemática
    const detalles = await client.query(
      `SELECT cd.id, cd.producto_id, cd.cantidad, cd.costo_unitario FROM ${TABLE.COMPRAS_DETALLE} cd
       WHERE cd.compra_id = $1 AND cd.activo = TRUE`,
      [id]
    );

    for (const detalle of detalles.rows) {
      // a. Revertir Kardex (Tu función original)
      const kardexMov = await client.query(
        `SELECT id FROM inventario.kardex 
         WHERE referencia_tipo = 'compra' AND referencia_id = $1 AND producto_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [id, detalle.producto_id]
      );

      if (kardexMov.rows.length > 0) {
        await client.query(
          `SELECT inventario.fn_revertir_kardex($1, $2, $3)`,
          [kardexMov.rows[0].id, usuario_id, `Anulación Compra #${id} - ${motivo || 'Sin motivo'}`]
        );
      }

      // b. Revertir Stock y Costo Promedio en la tabla PRODUCTOS
      const prodRes = await client.query(
        `SELECT stock_actual, costo_promedio FROM ${TABLE.PRODUCTOS} WHERE id = $1`,
        [detalle.producto_id]
      );

      const stockActual = parseFloat(prodRes.rows[0].stock_actual) || 0;
      const costoActual = parseFloat(prodRes.rows[0].costo_promedio) || 0;
      const cantAnulada = parseFloat(detalle.cantidad);
      const precioAnulado = parseFloat(detalle.costo_unitario);

      const nuevoStock = stockActual - cantAnulada;
      let nuevoCosto = costoActual;

      // Recalcular el costo promedio sacando esta compra de la ecuación
      if (nuevoStock > 0) {
        const valorRestante = (stockActual * costoActual) - (cantAnulada * precioAnulado);
        nuevoCosto = Math.max(0, valorRestante / nuevoStock); // Evitar negativos por decimales
      }

      await client.query(
        `UPDATE ${TABLE.PRODUCTOS} 
         SET stock_actual = $1, costo_promedio = $2, updated_at = NOW() 
         WHERE id = $3`,
        [Math.max(0, nuevoStock), nuevoCosto, detalle.producto_id]
      );
    }

    // 3. Revertir el dinero a la caja (Ingreso)
    if (compraInfo.caja_movimiento_id) {
      const cajaMovOrigin = await client.query(
        `SELECT caja_id FROM pos.caja_movimientos WHERE id = $1`,
        [compraInfo.caja_movimiento_id]
      );

      if (cajaMovOrigin.rows.length > 0) {
        await client.query(
          `INSERT INTO pos.caja_movimientos 
           (caja_id, tipo, descripcion, monto, usuario_id, referencia_tipo, referencia_id, activo)
           VALUES ($1, 'ingreso', $2, $3, $4, 'anulacion_compra', $5, TRUE)`,
          [cajaMovOrigin.rows[0].caja_id, `Reembolso por anulación de Compra #${id}`, compraInfo.total, usuario_id, id]
        );
      }
    }

    // 4. Desactivar la compra y sus detalles
    await client.query(
      `UPDATE ${TABLE.COMPRAS} SET activo = FALSE, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query(
      `UPDATE ${TABLE.COMPRAS_DETALLE} SET activo = FALSE WHERE compra_id = $1`,
      [id]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Compra anulada. Stock y costos revertidos.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  // Proveedores
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  // Compras
  getAllCompras,
  getCompraById,
  createCompra,
  anularCompra,
};