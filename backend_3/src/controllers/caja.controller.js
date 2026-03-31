const catchAsync = require('../utils/catchAsync');
const cajaService = require('../services/caja.service');
const AppError = require('../utils/AppError');

const obtenerEstado = catchAsync(async (req, res) => {
  const caja = await cajaService.obtenerCajaAbierta();

  res.json({
    success: true,
    data: {
      caja_abierta: caja !== null,
      caja,
    },
  });
});

const abrir = catchAsync(async (req, res) => {
  const { monto_inicial, observaciones } = req.body;

  if (monto_inicial === undefined || monto_inicial === null) {
    throw AppError.badRequest('El monto inicial es requerido');
  }

  const caja = await cajaService.abrirCaja(
    { monto_inicial, observaciones },
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: 'Caja abierta correctamente',
    data: { caja },
  });
});

const registrarMovimiento = catchAsync(async (req, res) => {
  const { caja_id, tipo, descripcion, monto, venta_id } = req.body;

  if (!caja_id || !tipo || !monto) {
    throw AppError.badRequest('Caja, tipo y monto son requeridos');
  }

  const movimiento = await cajaService.registrarMovimiento(
    { caja_id, tipo, descripcion, monto, venta_id },
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: 'Movimiento registrado correctamente',
    data: { movimiento },
  });
});

const cerrar = catchAsync(async (req, res) => {
  const {
    total_efectivo,
    total_tarjeta,
    total_otro,
    monto_final_real,
    observaciones
  } = req.body;

  if (!monto_final_real) {
    throw AppError.badRequest('El monto final real es requerido para el cierre');
  }

  const cierre = await cajaService.cerrarCaja(
    req.params.id,
    { total_efectivo, total_tarjeta, total_otro, monto_final_real, observaciones },
    req.user.id
  );

  const mensaje = cierre.diferencia === 0
    ? 'Caja cerrada correctamente. Cuadre perfecto.'
    : `Caja cerrada con diferencia de S/ ${cierre.diferencia}. Verificar arqueo.`;

  res.json({
    success: true,
    message: mensaje,
    data: {
      cierre,
      alerta_diferencia: cierre.diferencia !== 0,
    },
  });
});

const obtenerMovimientos = catchAsync(async (req, res) => {
  const movimientos = await cajaService.obtenerMovimientosPorCaja(
    req.params.caja_id,
    req.query
  );

  res.json({
    success: true,
    data: { movimientos },
  });
});

const obtenerReporte = catchAsync(async (req, res) => {
  const reporte = await cajaService.obtenerReporteCajaDia(req.query.fecha);

  res.json({
    success: true,
    data: { reporte },
  });
});
// Controller para getResumenDelDia
const getResumenDelDia = catchAsync(async (req, res) => {
  const cajaAbierta = await cajaService.obtenerCajaAbierta();

  if (!cajaAbierta) {
    return res.json({
      success: true,
      data: { resumen: null },
    });
  }

  const resumen = await cajaService.getResumenDelDia(cajaAbierta.id);

  res.json({
    success: true,
    data: { resumen },
  });
});

// Controller para getMovimientosDelDia
const getMovimientosDelDia = catchAsync(async (req, res) => {
  const cajaAbierta = await cajaService.obtenerCajaAbierta();

  if (!cajaAbierta) {
    return res.json({
      success: true,
      data: { movimientos: [] },
    });
  }

  const movimientos = await cajaService.getMovimientosDelDia(
    cajaAbierta.id,
    req.query
  );

  res.json({
    success: true,
    data: { movimientos },
  });
});

module.exports = {
  obtenerEstado,
  abrir,
  registrarMovimiento,
  cerrar,
  obtenerMovimientos,
  obtenerReporte,
  getResumenDelDia,      // ← NUEVO
  getMovimientosDelDia,
};