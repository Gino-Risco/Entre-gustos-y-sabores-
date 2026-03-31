const { query, TABLE, getClient } = require('../config/database');
const AppError = require('../utils/AppError');

async function obtenerCajaAbierta() {
  const result = await query(
    `SELECT ca.*, u.nombre AS usuario_nombre
     FROM ${TABLE.CAJA_APERTURAS} ca
     JOIN ${TABLE.USUARIOS} u ON u.id = ca.usuario_id
     WHERE ca.estado = 'abierta' AND ca.activo = TRUE
     ORDER BY ca.created_at DESC
     LIMIT 1`,
    []
  );

  return result.rows[0] || null;
}

async function obtenerCajaPorId(id) {
  const result = await query(
    `SELECT ca.*, u.nombre AS usuario_nombre
     FROM ${TABLE.CAJA_APERTURAS} ca
     JOIN ${TABLE.USUARIOS} u ON u.id = ca.usuario_id
     WHERE ca.id = $1 AND ca.activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Caja no encontrada');
  }

  return result.rows[0];
}

async function abrirCaja(data, usuario_id) {
  const { monto_inicial, observaciones } = data;

  // Validar que el usuario es cajero o admin
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0) {
    throw AppError.unauthorized('Usuario no válido');
  }

  if (!['cajero', 'administrador'].includes(usuario.rows[0].rol)) {
    throw AppError.forbidden('Solo cajeros pueden abrir caja');
  }

  // Validar que no haya otra caja abierta
  const cajaAbierta = await obtenerCajaAbierta();
  if (cajaAbierta) {
    throw AppError.conflict(
      `Ya existe una caja abierta (ID: ${cajaAbierta.id}). Debe cerrarla antes de abrir una nueva.`
    );
  }

  // Validar monto inicial
  if (monto_inicial < 0) {
    throw AppError.badRequest('El monto inicial no puede ser negativo');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Crear apertura de caja
    const result = await client.query(
      `INSERT INTO ${TABLE.CAJA_APERTURAS} 
       (usuario_id, monto_inicial, estado, observaciones, activo)
       VALUES ($1, $2, 'abierta', $3, TRUE)
       RETURNING *`,
      [usuario_id, monto_inicial, observaciones || null]
    );

    const caja = result.rows[0];

    // 2. Registrar movimiento de apertura
    await client.query(
      `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS} 
       (caja_id, tipo, descripcion, monto, usuario_id, activo)
       VALUES ($1, 'apertura', 'Apertura de caja', $2, $3, TRUE)`,
      [caja.id, monto_inicial, usuario_id]
    );

    await client.query('COMMIT');

    return await obtenerCajaPorId(caja.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function registrarMovimiento(data, usuario_id) {
  const { caja_id, tipo, descripcion, monto, venta_id, referencia_tipo, referencia_id } = data;

  // Validar tipo de movimiento
  const tiposValidos = ['ingreso', 'retiro', 'gasto'];
  if (!tiposValidos.includes(tipo)) {
    throw AppError.badRequest(
      `Tipo de movimiento inválido. Válidos para registro manual: ${tiposValidos.join(', ')}`
    );
  }

  // Validar que la caja existe y está abierta
  const caja = await obtenerCajaPorId(caja_id);
  if (caja.estado !== 'abierta') {
    throw AppError.conflict('La caja debe estar abierta para registrar movimientos');
  }

  // Validar monto
  // Permitir montos negativos (ingresos que se registran como retiros negativos)
  if (monto === 0) {
    throw AppError.badRequest('El monto debe ser diferente a cero');
  }

  // Si es retiro o gasto, validar que el usuario es cajero o admin
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (!['cajero', 'administrador'].includes(usuario.rows[0].rol)) {
    throw AppError.forbidden('Solo cajeros pueden registrar movimientos de caja');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS} 
        (caja_id, tipo, descripcion, monto, venta_id, usuario_id, referencia_tipo, referencia_id, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        RETURNING *`,
      [
        caja_id,
        tipo,
        descripcion || null,
        monto,
        venta_id || null,
        usuario_id,
        referencia_tipo || null, // 'compra'
        referencia_id || null    // ID de la compra
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cerrarCaja(caja_id, data, usuario_id) {
  const {
    total_efectivo,
    total_tarjeta,
    total_otro,
    monto_final_real,
    observaciones
  } = data;

  // Validar que el usuario es cajero o admin
  const usuario = await query(
    `SELECT u.id, u.nombre, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (!['cajero', 'administrador'].includes(usuario.rows[0].rol)) {
    throw AppError.forbidden('Solo cajeros pueden cerrar caja');
  }

  // Validar que la caja existe y está abierta
  const caja = await obtenerCajaPorId(caja_id);
  if (caja.estado !== 'abierta') {
    throw AppError.conflict('La caja debe estar abierta para cerrarla');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Obtener totales de movimientos del día (AQUÍ ESTABA EL ERROR, AHORA SÍ BUSCA "ingreso")
    const movimientos = await client.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo THEN monto ELSE 0 END), 0) AS total_ventas,
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' AND activo THEN monto ELSE 0 END), 0) AS total_ingresos,
         COALESCE(SUM(CASE WHEN tipo = 'retiro' AND activo THEN monto ELSE 0 END), 0) AS total_retiros,
         COALESCE(SUM(CASE WHEN tipo = 'gasto' AND activo THEN monto ELSE 0 END), 0) AS total_gastos
       FROM ${TABLE.CAJA_MOVIMIENTOS}
       WHERE caja_id = $1`,
      [caja_id]
    );

    const totals = movimientos.rows[0];

    // 2. Calcular monto final esperado de forma limpia
    const totalIngresos = parseFloat(totals.total_ingresos);
    const totalEgresos = parseFloat(totals.total_retiros) + parseFloat(totals.total_gastos);

    const monto_final_esperado =
      parseFloat(caja.monto_inicial) +
      parseFloat(totals.total_ventas) +
      totalIngresos -
      totalEgresos;

    // 3. Crear cierre de caja
    const cierreResult = await client.query(
      `INSERT INTO ${TABLE.CAJA_CIERRES} 
       (caja_id, usuario_id, total_ventas, total_efectivo, total_tarjeta, total_otro, 
        total_retiros, total_gastos, monto_inicial, monto_final_real, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        caja_id,
        usuario_id,
        totals.total_ventas,
        total_efectivo || 0,
        total_tarjeta || 0,
        total_otro || 0,
        totalEgresos,
        0,
        caja.monto_inicial,
        monto_final_real,
        observaciones || null
      ]
    );

    // 4. Actualizar caja a estado 'cerrada'
    await client.query(
      `UPDATE ${TABLE.CAJA_APERTURAS} 
       SET estado = 'cerrada', updated_at = NOW()
       WHERE id = $1`,
      [caja_id]
    );

    // 5. Registrar movimiento de cierre (Aseguramos que no mande 0 para no romper tu base de datos)
    const montoCierre = parseFloat(monto_final_real) > 0 ? parseFloat(monto_final_real) : 0.01;
    await client.query(
      `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS} 
       (caja_id, tipo, descripcion, monto, usuario_id, activo)
       VALUES ($1, 'cierre', 'Cierre de caja', $2, $3, TRUE)`,
      [caja_id, montoCierre, usuario_id]
    );

    await client.query('COMMIT');

    // Retornar cierre al Frontend para el Ticket
    const cierre = cierreResult.rows[0];
    const diferencia = parseFloat(monto_final_real) - parseFloat(monto_final_esperado);

    return {
      ...cierre,
      usuario_nombre: usuario.rows[0].nombre,
      monto_final_esperado,
      diferencia,
      ingresos_manuales: totalIngresos,
      egresos_manuales: totalEgresos,
      resumen: {
        monto_inicial: parseFloat(caja.monto_inicial),
        total_ventas: parseFloat(totals.total_ventas),
        total_ingresos: totalIngresos,
        total_retiros: parseFloat(totals.total_retiros),
        total_gastos: parseFloat(totals.total_gastos),
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function obtenerMovimientosPorCaja(caja_id, filtros = {}) {
  const { tipo, fecha_desde, fecha_hasta } = filtros;

  const conditions = ['cm.caja_id = $1', 'cm.activo = TRUE'];
  const params = [caja_id];
  let paramIndex = 2;

  if (tipo && tipo !== 'todos') {
    if (tipo === 'ingreso') {
      // Los ingresos se almacenan como retiros negativos
      conditions.push(`cm.tipo = 'retiro' AND cm.monto < 0`);
    } else if (tipo === 'retiro') {
      // Para retiro, excluir los negativos (que son ingresos)
      conditions.push(`cm.tipo = $${paramIndex} AND cm.monto > 0`);
      params.push(tipo);
      paramIndex++;
    } else {
      conditions.push(`cm.tipo = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }
  }

  if (fecha_desde) {
    conditions.push(`cm.created_at >= $${paramIndex}`);
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    conditions.push(`cm.created_at <= $${paramIndex}`);
    params.push(fecha_hasta);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT cm.*, u.nombre AS usuario_nombre, v.numero_ticket
     FROM ${TABLE.CAJA_MOVIMIENTOS} cm
     JOIN ${TABLE.USUARIOS} u ON u.id = cm.usuario_id
     LEFT JOIN ${TABLE.VENTAS} v ON v.id = cm.venta_id
     WHERE ${whereClause}
     ORDER BY cm.created_at DESC`,
    params
  );

  return result.rows;
}

async function obtenerReporteCajaDia(fecha) {
  const result = await query(
    `SELECT * FROM pos.v_caja_dia WHERE fecha_apertura::date = $1`,
    [fecha || new Date().toISOString().split('T')[0]]
  );

  return result.rows;
}


// ============================================
// Obtener resumen del día con cards por método de pago
// ============================================
// ============================================
// Obtener resumen del turno EXACTO (Sin límite de horas)
// ============================================
async function getResumenDelDia(caja_id) {
  // Obtener datos de la caja
  const caja = await obtenerCajaPorId(caja_id);

  // 1. Obtener ventas EXACTAS de esta caja usando sus movimientos
  const ventasPorMetodo = await query(
    `SELECT v.metodo_pago, 
            COUNT(v.id) as cantidad_ventas,
            SUM(v.total) as total_monto
     FROM ${TABLE.CAJA_MOVIMIENTOS} cm
     JOIN ${TABLE.VENTAS} v ON v.id = cm.venta_id
     WHERE cm.caja_id = $1 
       AND cm.tipo = 'venta' 
       AND cm.activo = TRUE
     GROUP BY v.metodo_pago`,
    [caja_id]
  );

  // 2. Obtener movimientos manuales (gastos/retiros) EXACTOS de esta caja
  const movimientosEfectivo = await query(
    `SELECT tipo, SUM(monto) as total
     FROM ${TABLE.CAJA_MOVIMIENTOS}
     WHERE caja_id = $1 
       AND tipo IN ('ingreso', 'retiro', 'gasto')
       AND activo = TRUE
     GROUP BY tipo`,
    [caja_id]
  );

  // Procesar datos para cards
  const cards = {
    efectivo: { label: 'Efectivo', icon: '💵', monto: 0, ventas: 0 },
    tarjeta: { label: 'Tarjeta', icon: '💳', monto: 0, ventas: 0 },
    yape: { label: 'Yape', icon: '📱', monto: 0, ventas: 0 },
    plin: { label: 'Plin', icon: '📱', monto: 0, ventas: 0 },
    total: { label: 'Total', icon: '💰', monto: 0, ventas: 0 },
  };

  // Llenar cards con datos de ventas
  ventasPorMetodo.rows.forEach(row => {
    const metodo = row.metodo_pago;
    if (cards[metodo]) {
      cards[metodo].monto = parseFloat(row.total_monto) || 0;
      cards[metodo].ventas = parseInt(row.cantidad_ventas) || 0;
    }
    if (metodo === 'mixto') {
      cards.total.monto += parseFloat(row.total_monto) || 0;
      cards.total.ventas += parseInt(row.cantidad_ventas) || 0;
    }
  });

  // Calcular total general de ventas
  cards.total.monto = Object.values(cards)
    .filter(c => c.label !== 'Total')
    .reduce((sum, c) => sum + c.monto, 0);
  cards.total.ventas = Object.values(cards)
    .filter(c => c.label !== 'Total')
    .reduce((sum, c) => sum + c.ventas, 0);

  // Calcular resumen numérico LIMPIO
  const ingresoRow = movimientosEfectivo.rows.find(m => m.tipo === 'ingreso');
  const retiroRow = movimientosEfectivo.rows.find(m => m.tipo === 'retiro');
  const gastoRow = movimientosEfectivo.rows.find(m => m.tipo === 'gasto');

  const ingresosManuales = Math.abs(parseFloat(ingresoRow?.total || 0));
  const egresosManuales = Math.abs(parseFloat(retiroRow?.total || 0)) + Math.abs(parseFloat(gastoRow?.total || 0));

  // Fórmula final de Saldo Esperado (Solo sumamos ventas en efectivo)
  const saldoEsperado =
    parseFloat(caja.monto_inicial) +
    (cards.efectivo.monto || 0) +
    ingresosManuales -
    egresosManuales;

  return {
    caja,
    cards,
    resumen: {
      fondo_inicial: parseFloat(caja.monto_inicial),
      total_ventas: cards.total.monto,
      ingresos_manuales: ingresosManuales,
      egresos_manuales: egresosManuales,
      saldo_esperado: parseFloat(saldoEsperado.toFixed(2)),
    },
  };
}
// ============================================
// Obtener historial de movimientos con filtros
// ============================================
async function getMovimientosDelDia(caja_id, filtros = {}) {
  const { tipo, metodo_pago, fecha_desde, fecha_hasta } = filtros;

  const conditions = ['cm.caja_id = $1', 'cm.activo = TRUE'];
  const params = [caja_id];
  let paramIndex = 2;

  // Manejar filtro de tipo, considerando que ingresos = retiros negativos
  // Manejar filtro de tipo, considerando que ingresos = retiros negativos
  if (tipo && tipo !== 'todos') {
    conditions.push(`cm.tipo = $${paramIndex}`);
    params.push(tipo);
    paramIndex++;
  }

  if (fecha_desde) {
    conditions.push(`cm.created_at >= $${paramIndex}`);
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    conditions.push(`cm.created_at <= $${paramIndex}`);
    params.push(fecha_hasta);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT cm.*, 
          u.nombre AS usuario_nombre, 
          v.numero_ticket,
          v.metodo_pago AS metodo_pago_venta
   FROM ${TABLE.CAJA_MOVIMIENTOS} cm
   JOIN ${TABLE.USUARIOS} u ON u.id = cm.usuario_id
   LEFT JOIN ${TABLE.VENTAS} v ON v.id = cm.venta_id
   WHERE ${whereClause}
   ORDER BY cm.created_at DESC`,
    params
  );

  return result.rows;
}

module.exports = {
  obtenerCajaAbierta,
  obtenerCajaPorId,
  abrirCaja,
  registrarMovimiento,
  cerrarCaja,
  obtenerMovimientosPorCaja,
  obtenerReporteCajaDia,
  getResumenDelDia,
  getMovimientosDelDia,
};