const catchAsync = require('../utils/catchAsync');
const productosService = require('../services/productos.service');

const getAll = catchAsync(async (req, res) => {
  const filtros = req.query;
  const productos = await productosService.getAllProductos(filtros);
  res.json({ success: true, data: { productos } });
});

const getById = catchAsync(async (req, res) => {
  const producto = await productosService.getProductById(req.params.id);
  res.json({ success: true, data: { producto } });
});

const create = catchAsync(async (req, res) => {
  const producto = await productosService.createProducto(req.body);
  res.status(201).json({ success: true, data: { producto } });
});

const update = catchAsync(async (req, res) => {
  const producto = await productosService.updateProducto(req.params.id, req.body);
  res.json({ success: true, data: { producto } });
});

const remove = catchAsync(async (req, res) => {
  const result = await productosService.deleteProducto(req.params.id);
  res.json({ success: true, data: result });
});

const toggleActivo = catchAsync(async (req, res) => {
  const producto = await productosService.toggleActivo(req.params.id, req.body.activo);
  res.json({ success: true, data: { producto } });
});

const toggleDisponibleEnMenu = catchAsync(async (req, res) => {
  const producto = await productosService.toggleDisponibleEnMenu(req.params.id, req.body.disponible_en_menu);
  res.json({ success: true, data: { producto } });
});

const getProductosParaMenu = catchAsync(async (req, res) => {
  const productos = await productosService.getProductosParaMenu();
  res.json({ success: true, data: { productos } });
});

const stockBajo = catchAsync(async (req, res) => {
  const productos = await productosService.getStockBajo();
  res.json({ success: true, data: { productos } });
});

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  toggleActivo,
  toggleDisponibleEnMenu,
  getProductosParaMenu,
  stockBajo,
};