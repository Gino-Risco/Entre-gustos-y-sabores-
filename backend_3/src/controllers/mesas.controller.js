const catchAsync = require('../utils/catchAsync');
const mesasService = require('../services/mesas.service');

const getAll = catchAsync(async (req, res) => {
  const mesas = await mesasService.getAllMesas(req.query);
  res.json({ success: true, data: { mesas } });
});

const getById = catchAsync(async (req, res) => {
  const mesa = await mesasService.getMesaById(req.params.id);
  res.json({ success: true, data: { mesa } });
});

const create = catchAsync(async (req, res) => {
  const mesa = await mesasService.createMesa(req.body);
  res.status(201).json({ success: true, data: { mesa } });
});

const update = catchAsync(async (req, res) => {
  const mesa = await mesasService.updateMesa(req.params.id, req.body);
  res.json({ success: true, data: { mesa } });
});

const remove = catchAsync(async (req, res) => {
  const result = await mesasService.deleteMesa(req.params.id);
  res.json({ success: true, data: result });
});

const updateEstado = catchAsync(async (req, res) => {
  const { estado } = req.body;
  
  if (!estado) {
    throw AppError.badRequest('El estado es requerido');
  }

  const mesa = await mesasService.updateEstadoMesa(req.params.id, estado);
  res.json({ success: true, data: { mesa } });
});

module.exports = { getAll, getById, create, update, remove, updateEstado };