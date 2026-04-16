const catchAsync = require('../utils/catchAsync');
const reportesService = require('../services/reportes.service');
const AppError = require('../utils/AppError');

const getVentasPorPeriodo = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta, agrupar_por = 'dia' } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const reporte = await reportesService.getVentasPorPeriodo(fecha_desde, fecha_hasta, agrupar_por);
  res.json({ success: true, data: { reporte } });
});

const getProductosMasVendidos = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta, limite = 20 } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const reporte = await reportesService.getProductosMasVendidos(
    fecha_desde,
    fecha_hasta,
    parseInt(limite)
  );
  res.json({ success: true, data: { reporte } });
});

const getVentasPorCategoria = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const reporte = await reportesService.getVentasPorCategoria(fecha_desde, fecha_hasta);
  res.json({ success: true, data: { reporte } });
});

const getVentasPorMetodoPago = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const reporte = await reportesService.getVentasPorMetodoPago(fecha_desde, fecha_hasta);
  res.json({ success: true, data: { reporte } });
});

const getVentasPorMesa = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const reporte = await reportesService.getVentasPorMesa(fecha_desde, fecha_hasta);
  res.json({ success: true, data: { reporte } });
});

const getVentasPorMesero = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const reporte = await reportesService.getVentasPorMesero(fecha_desde, fecha_hasta);
  res.json({ success: true, data: { reporte } });
});

const getCajaReporte = catchAsync(async (req, res) => {
  const { fecha } = req.query;
  const reporte = await reportesService.getCajaReporte(fecha);
  res.json({ success: true, data: { reporte } });
});

const getAlertasStock = catchAsync(async (req, res) => {
  const alertas = await reportesService.getAlertasStockPendientes();
  res.json({ success: true, data: { alertas } });
});

const getDashboard = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const dashboard = await reportesService.getDashboardResumen(fecha_desde, fecha_hasta);
  res.json({ success: true, data: { dashboard } });
});

// ==================== NUEVOS CONTROLLERS PARA DASHBOARD ====================

/**
 * GET /api/reportes/dashboard/ventas-hora
 */
const getVentasPorHora = catchAsync(async (req, res) => {
  const { fecha } = req.query;
  const data = await reportesService.getVentasPorHora(fecha);
  res.json({ success: true, data: { ventas_por_hora: data } });
});

/**
 * GET /api/reportes/dashboard/metodos-pago
 */
const getVentasPorMetodoPagoHoy = catchAsync(async (req, res) => {
  const { fecha } = req.query;
  const data = await reportesService.getVentasPorMetodoPagoHoy(fecha);
  res.json({ success: true, data: { metodos_pago: data } });
});

/**
 * GET /api/reportes/dashboard/top-productos
 */
const getTopProductosHoy = catchAsync(async (req, res) => {
  const { fecha, limite = 5 } = req.query;
  const data = await reportesService.getTopProductosHoy(fecha, parseInt(limite));
  res.json({ success: true, data: { top_productos: data } });
});

/**
 * GET /api/reportes/dashboard/ordenes-activas
 */
const getUltimasOrdenesActivas = catchAsync(async (req, res) => {
  const { limite = 5 } = req.query;
  const data = await reportesService.getUltimasOrdenesActivas(parseInt(limite));
  res.json({ success: true, data: { ordenes: data } });
});



module.exports = {
  getVentasPorPeriodo,
  getProductosMasVendidos,
  getVentasPorCategoria,
  getVentasPorMetodoPago,
  getVentasPorMesa,
  getVentasPorMesero,
  getCajaReporte,
  getAlertasStock,
  getDashboard,
  getVentasPorHora,
  getVentasPorMetodoPagoHoy,
  getTopProductosHoy,
  getUltimasOrdenesActivas
};