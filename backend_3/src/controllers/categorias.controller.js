const catchAsync = require('../utils/catchAsync');
const categoriasService = require('../services/categorias.service');

const getAll = catchAsync(async (req, res) => {
  const categorias = await categoriasService.getAllCategorias(req.query);
  res.json({ success: true, data: { categorias } });
});

const getById = catchAsync(async (req, res) => {
  const categoria = await categoriasService.getCategoriaById(req.params.id);
  res.json({ success: true, data: { categoria } });
});

const create = catchAsync(async (req, res) => {
  const categoria = await categoriasService.createCategoria(req.body);
  res.status(201).json({ success: true, data: { categoria } });
});

const update = catchAsync(async (req, res) => {
  const categoria = await categoriasService.updateCategoria(req.params.id, req.body);
  res.json({ success: true, data: { categoria } });
});

const remove = catchAsync(async (req, res) => {
  const result = await categoriasService.deleteCategoria(req.params.id);
  res.json({ success: true, data: result });
});

module.exports = { getAll, getById, create, update, remove };