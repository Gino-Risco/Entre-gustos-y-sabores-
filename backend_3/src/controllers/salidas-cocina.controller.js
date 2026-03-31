const catchAsync = require('../utils/catchAsync');
const salidasCocinaService = require('../services/salidas-cocina.service');
const AppError = require('../utils/AppError');

const getAll = catchAsync(async (req, res) => {
  const salidas = await salidasCocinaService.getAllSalidas(req.query);
  res.json({ success: true, data: { salidas } });
});

const getById = catchAsync(async (req, res) => {
  const salida = await salidasCocinaService.getSalidaById(req.params.id);
  res.json({ success: true, data: { salida } });
});

const getPendientes = catchAsync(async (req, res) => {
  const salidas = await salidasCocinaService.getSalidasPendientes();
  res.json({ success: true, data: { salidas } });
});

const crear = catchAsync(async (req, res) => {
  const { turno, detalles, observaciones } = req.body;

  if (!detalles || !Array.isArray(detalles)) {
    throw AppError.badRequest('Los detalles son requeridos y deben ser un array');
  }

  if (detalles.length === 0) {
    throw AppError.badRequest('Debe proporcionar al menos un detalle de salida');
  }

  // Validar estructura de cada detalle
  for (const detalle of detalles) {
    if (!detalle.producto_id || !detalle.cantidad) {
      throw AppError.badRequest('Cada detalle debe tener producto_id y cantidad');
    }

    if (detalle.cantidad <= 0) {
      throw AppError.badRequest('La cantidad debe ser mayor a cero');
    }
  }

  const salida = await salidasCocinaService.crearSalida(
    { turno, detalles, observaciones },
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: 'Salida de cocina registrada. Pendiente de aprobación para descontar stock.',
    data: { salida },
  });
});

const aprobar = catchAsync(async (req, res) => {
  const salida = await salidasCocinaService.aprobarSalida(req.params.id, req.user.id);

  res.json({
    success: true,
    message: 'Salida de cocina aprobada. Stock descontado automáticamente en kardex.',
    data: { salida },
  });
});

const revertir = catchAsync(async (req, res) => {
  const { motivo } = req.body;

  if (!motivo) {
    throw AppError.badRequest('El motivo de reversión es requerido');
  }

  const result = await salidasCocinaService.revertirAprobacion(
    req.params.id,
    req.user.id,
    motivo
  );

  res.json({
    success: true,
    message: 'Salida de cocina revertida. Stock restaurado automáticamente.',
    data: result,
  });
});

module.exports = {
  getAll,
  getById,
  getPendientes,
  crear,
  aprobar,
  revertir,
};