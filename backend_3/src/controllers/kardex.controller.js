const catchAsync = require('../utils/catchAsync');
const kardexService = require('../services/kardex.service');
const AppError = require('../utils/AppError');

const getAll = catchAsync(async (req, res) => {
  const kardex = await kardexService.getAllKardex(req.query);
  res.json({ success: true, data: { kardex } });
});

const getById = catchAsync(async (req, res) => {
  const movimiento = await kardexService.getKardexById(req.params.id);
  res.json({ success: true, data: { movimiento } });
});

const getPorProducto = catchAsync(async (req, res) => {
  const { limite = 100 } = req.query;
  const kardex = await kardexService.getKardexPorProducto(req.params.producto_id, parseInt(limite));
  res.json({ success: true, data: { kardex } });
});

const revertir = catchAsync(async (req, res) => {
  const { motivo } = req.body;

  if (!motivo) {
    throw AppError.badRequest('El motivo de reversión es requerido');
  }

  const movimiento = await kardexService.revertirMovimiento(
    req.params.id,
    req.user.id,
    motivo
  );

  res.json({
    success: true,
    message: 'Movimiento revertido correctamente. Stock restaurado.',
    data: { movimiento },
  });
});

const getResumen = catchAsync(async (req, res) => {
  const { fecha_desde, fecha_hasta } = req.query;

  if (!fecha_desde || !fecha_hasta) {
    throw AppError.badRequest('fecha_desde y fecha_hasta son requeridos');
  }

  const resumen = await kardexService.getResumenKardex(fecha_desde, fecha_hasta);
  res.json({ success: true, data: { resumen } });
});

const getValorizacion = catchAsync(async (req, res) => {
  const valorizacion = await kardexService.getValorizacionInventario();
  res.json({ success: true, data: { valorizacion } });
});

module.exports = {
  getAll,
  getById,
  getPorProducto,
  revertir,
  getResumen,
  getValorizacion,
};