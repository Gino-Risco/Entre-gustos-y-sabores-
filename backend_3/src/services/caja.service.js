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

async function obtenerFondoSugerido() {
  // Obtener el fondo reservado del última cierre registrado
  // Esto será usado como sugerencia al abrir una nueva caja
  const result = await query(
    `SELECT cc.fondo_reservado_proximo, cc.created_at 
     FROM ${TABLE.CAJA_CIERRES} cc
     WHERE cc.fondo_reservado_proximo > 0
     ORDER BY cc.created_at DESC 
     LIMIT 1`,
    []
  );

  if (result.rows.length > 0) {
    const fondo = parseFloat(result.rows[0].fondo_reservado_proximo) || 0;
    return fondo;
  }

  return 0;
}
async function abrirCaja(data, usuario_id) {
  const { monto_inicial, observaciones } = data;

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

  const cajaAbierta = await obtenerCajaAbierta();
  if (cajaAbierta) {
    throw AppError.conflict(
      `Ya existe una caja abierta (ID: ${cajaAbierta.id}). Debe cerrarla antes de abrir una nueva.`
    );
  }

  if (monto_inicial < 0) {
    throw AppError.badRequest('El monto inicial no puede ser negativo');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO ${TABLE.CAJA_APERTURAS}
       (usuario_id, monto_inicial, estado, observaciones, activo)
       VALUES ($1, $2, 'abierta', $3, TRUE)
       RETURNING *`,
      [usuario_id, monto_inicial, observaciones || null]
    );

    const caja = result.rows[0];

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

  const tiposValidos = ['ingreso', 'retiro', 'gasto'];
  if (!tiposValidos.includes(tipo)) {
    throw AppError.badRequest(
      `Tipo de movimiento inválido. Válidos para registro manual: ${tiposValidos.join(', ')}`
    );
  }

  const caja = await obtenerCajaPorId(caja_id);
  if (caja.estado !== 'abierta') {
    throw AppError.conflict('La caja debe estar abierta para registrar movimientos');
  }

  if (monto === 0) {
    throw AppError.badRequest('El monto debe ser diferente a cero');
  }

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
        referencia_tipo || null,
        referencia_id || null
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
  // Del frontend SOLO aceptamos estos tres valores que el cajero ingresa manualmente:
  // monto_final_real  → lo que contó físicamente en la gaveta
  // fondo_reservado_proximo → lo que deja para mañana
  // observaciones     → nota opcional
  // El resto (ventas, ingresos, egresos) se calcula desde la BD
  const {
    monto_final_real,
    fondo_reservado_proximo,
    observaciones
  } = data;

  const usuario = await query(
    `SELECT u.id, u.nombre, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (!['cajero', 'administrador'].includes(usuario.rows[0].rol)) {
    throw AppError.forbidden('Solo cajeros pueden cerrar caja');
  }

  const caja = await obtenerCajaPorId(caja_id);
  if (caja.estado !== 'abierta') {
    throw AppError.conflict('La caja debe estar abierta para cerrarla');
  }

  if (parseFloat(monto_final_real) < 0) {
    throw AppError.badRequest('El monto final no puede ser negativo');
  }

  if (parseFloat(fondo_reservado_proximo || 0) > parseFloat(monto_final_real)) {
    throw AppError.badRequest('El fondo para mañana no puede superar el monto final contado');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Obtener todos los totales DESDE LA BD — el frontend no puede alterar esto
    const resumenActual = await getResumenDelDia(caja_id);

    const efectivoVentas = parseFloat(resumenActual.cards.efectivo.monto || 0);
    const ventasTarjeta = parseFloat(resumenActual.cards.tarjeta.monto || 0);
    const ventasOtro =
      parseFloat(resumenActual.cards.yape.monto || 0) +
      parseFloat(resumenActual.cards.plin.monto || 0);
    const totalVentasGlobal = parseFloat(resumenActual.resumen.total_ventas || 0);
    const totalIngresos = parseFloat(resumenActual.resumen.ingresos_manuales || 0);
    const totalEgresos = parseFloat(resumenActual.resumen.egresos_manuales || 0);

    // 2. Calcular esperado con SOLO efectivo físico (yape/tarjeta no van a la gaveta)
    const monto_final_esperado =
      parseFloat(caja.monto_inicial) + efectivoVentas + totalIngresos - totalEgresos;

    const diferencia = parseFloat(monto_final_real) - monto_final_esperado;
    const montoRetirado =
      parseFloat(monto_final_real) - parseFloat(fondo_reservado_proximo || 0);

    // 3. Insertar cierre — todos los montos de ventas vienen de la BD, no del frontend
    const cierreResult = await client.query(
      `INSERT INTO ${TABLE.CAJA_CIERRES}
       (caja_id, usuario_id, turno,
        total_ventas, total_efectivo, total_tarjeta, total_otro,
        total_retiros, total_gastos, total_ingresos,
        monto_inicial, monto_final_real,
        monto_final_esperado, diferencia,
        fondo_reservado_proximo, monto_retirado_dueno,
        observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) 
       RETURNING *`,
      [
        caja_id,                                 // $1
        usuario_id,                              // $2
        data.turno,                              // $3
        totalVentasGlobal,                       // $4
        efectivoVentas,                          // $5
        ventasTarjeta,                           // $6
        ventasOtro,                              // $7
        totalEgresos,                            // $8
        0,                                       // $9
        totalIngresos,                           // $10
        parseFloat(caja.monto_inicial),          // $11
        parseFloat(monto_final_real),            // $12
        monto_final_esperado,                    // $13
        diferencia,                              // $14
        parseFloat(fondo_reservado_proximo || 0),// $15
        montoRetirado,                           // $16
        observaciones || null                    // $17
      ]
    );

    // 4. Cerrar la apertura
    await client.query(
      `UPDATE ${TABLE.CAJA_APERTURAS}
       SET estado = 'cerrada', updated_at = NOW()
       WHERE id = $1`,
      [caja_id]
    );

    // 5. Registrar retiro de utilidades si aplica
    if (montoRetirado > 0) {
      await client.query(
        `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS}
         (caja_id, tipo, descripcion, monto, usuario_id, activo)
         VALUES ($1, 'retiro', 'Retiro de utilidades por cierre de caja', $2, $3, TRUE)`,
        [caja_id, montoRetirado, usuario_id]
      );
    }

    // 6. Movimiento simbólico de cierre
    await client.query(
      `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS}
       (caja_id, tipo, descripcion, monto, usuario_id, activo)
       VALUES ($1, 'cierre', 'Cierre de caja', 0.01, $2, TRUE)`,
      [caja_id, usuario_id]
    );

    await client.query('COMMIT');

    const cierre = cierreResult.rows[0];

    return {
      ...cierre,
      usuario_nombre: usuario.rows[0].nombre,
      monto_final_esperado,
      diferencia,
      ingresos_manuales: totalIngresos,
      egresos_manuales: totalEgresos,
      resumen: {
        monto_inicial: parseFloat(caja.monto_inicial),
        ventas_efectivo: efectivoVentas,
        ventas_tarjeta: ventasTarjeta,
        ventas_otro: ventasOtro,
        total_ventas: totalVentasGlobal,
        total_ingresos: totalIngresos,
        total_retiros: totalEgresos,
        total_gastos: 0,
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

  const result = await query(
    `SELECT cm.*, u.nombre AS usuario_nombre, v.numero_ticket
     FROM ${TABLE.CAJA_MOVIMIENTOS} cm
     JOIN ${TABLE.USUARIOS} u ON u.id = cm.usuario_id
     LEFT JOIN ${TABLE.VENTAS} v ON v.id = cm.venta_id
     WHERE ${conditions.join(' AND ')}
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

async function getResumenDelDia(caja_id) {
  const caja = await obtenerCajaPorId(caja_id);

  const ventasPorMetodo = await query(
    `SELECT v.metodo_pago,
            COUNT(v.id)  AS cantidad_ventas,
            SUM(v.total) AS total_monto
     FROM ${TABLE.CAJA_MOVIMIENTOS} cm
     JOIN ${TABLE.VENTAS} v ON v.id = cm.venta_id
     WHERE cm.caja_id = $1
       AND cm.tipo    = 'venta'
       AND cm.activo  = TRUE
     GROUP BY v.metodo_pago`,
    [caja_id]
  );

  const movimientosEfectivo = await query(
    `SELECT tipo, SUM(monto) AS total
     FROM ${TABLE.CAJA_MOVIMIENTOS}
     WHERE caja_id = $1
       AND tipo IN ('ingreso', 'retiro', 'gasto')
       AND activo = TRUE
     GROUP BY tipo`,
    [caja_id]
  );

  const cards = {
    efectivo: { label: 'Efectivo', icon: '💵', monto: 0, ventas: 0 },
    tarjeta: { label: 'Tarjeta', icon: '💳', monto: 0, ventas: 0 },
    yape: { label: 'Yape', icon: '📱', monto: 0, ventas: 0 },
    plin: { label: 'Plin', icon: '📱', monto: 0, ventas: 0 },
    total: { label: 'Total', icon: '💰', monto: 0, ventas: 0 },
  };

  ventasPorMetodo.rows.forEach(row => {
    const metodo = row.metodo_pago;
    if (cards[metodo]) {
      cards[metodo].monto = parseFloat(row.total_monto) || 0;
      cards[metodo].ventas = parseInt(row.cantidad_ventas, 10) || 0;
    }
  });

  cards.total.monto = Object.values(cards)
    .filter(c => c.label !== 'Total')
    .reduce((s, c) => s + c.monto, 0);
  cards.total.ventas = Object.values(cards)
    .filter(c => c.label !== 'Total')
    .reduce((s, c) => s + c.ventas, 0);

  const ingresoRow = movimientosEfectivo.rows.find(m => m.tipo === 'ingreso');
  const retiroRow = movimientosEfectivo.rows.find(m => m.tipo === 'retiro');
  const gastoRow = movimientosEfectivo.rows.find(m => m.tipo === 'gasto');

  const ingresosManuales =
    Math.abs(parseFloat(ingresoRow?.total || 0));
  const egresosManuales =
    Math.abs(parseFloat(retiroRow?.total || 0)) +
    Math.abs(parseFloat(gastoRow?.total || 0));

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
      ventas_efectivo: cards.efectivo.monto,
      ventas_tarjeta: cards.tarjeta.monto,
      ingresos_manuales: ingresosManuales,
      egresos_manuales: egresosManuales,
      saldo_esperado: parseFloat(saldoEsperado.toFixed(2)),
    },
  };
}

async function getMovimientosDelDia(caja_id, filtros = {}) {
  const { tipo, fecha_desde, fecha_hasta } = filtros;

  const conditions = ['cm.caja_id = $1', 'cm.activo = TRUE'];
  const params = [caja_id];
  let paramIndex = 2;

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

  const result = await query(
    `SELECT cm.*,
            u.nombre      AS usuario_nombre,
            v.numero_ticket,
            v.metodo_pago AS metodo_pago_venta
     FROM ${TABLE.CAJA_MOVIMIENTOS} cm
     JOIN ${TABLE.USUARIOS} u ON u.id = cm.usuario_id
     LEFT JOIN ${TABLE.VENTAS} v ON v.id = cm.venta_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cm.created_at DESC`,
    params
  );

  return result.rows;
}

async function registrarArqueoParcial(caja_id, data, usuario_id) {
  const { monto_contado, observaciones } = data;

  const caja = await obtenerCajaPorId(caja_id);
  if (caja.estado !== 'abierta') {
    throw AppError.conflict('La caja debe estar abierta para realizar un arqueo');
  }

  const resumen = await getResumenDelDia(caja_id);
  const monto_esperado = resumen.resumen.saldo_esperado;

  // No se pasa diferencia: la BD la genera con GENERATED ALWAYS AS
  const result = await query(
    `INSERT INTO ${TABLE.CAJA_ARQUEOS}
     (caja_id, usuario_id, monto_esperado, monto_contado, observaciones)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [caja_id, usuario_id, monto_esperado, parseFloat(monto_contado), observaciones || null]
  );

  return {
    arqueo: result.rows[0],
    resumen_caja: resumen.resumen
  };
}

async function obtenerHistorialCajas() {
  const result = await query(
    `SELECT ca.id, 
            ca.monto_inicial, 
            ca.estado, 
            ca.created_at, 
            COALESCE(cc.observaciones, ca.observaciones) AS observaciones,
            u.nombre AS usuario_nombre,
            cc.turno,
            cc.total_ventas, 
            cc.total_efectivo,
            cc.total_tarjeta,
            cc.total_otro,
            cc.total_ingresos,
            cc.total_gastos,
            cc.total_retiros,
            cc.monto_final_esperado,
            cc.monto_final_real,
            cc.diferencia,
            cc.fondo_reservado_proximo,
            cc.monto_retirado_dueno
            
     FROM ${TABLE.CAJA_APERTURAS} ca
     JOIN ${TABLE.USUARIOS} u ON u.id = ca.usuario_id
     LEFT JOIN ${TABLE.CAJA_CIERRES} cc ON cc.caja_id = ca.id
     WHERE ca.activo = TRUE
     ORDER BY ca.created_at DESC`
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
  obtenerFondoSugerido,
  registrarArqueoParcial,
  obtenerHistorialCajas,
};