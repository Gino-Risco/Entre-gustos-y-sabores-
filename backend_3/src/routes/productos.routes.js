const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productos.controller');

// Obtener todos los productos
router.get('/', productosController.getAll);

// Obtener productos con stock bajo
router.get('/reportes/stock-bajo', productosController.stockBajo);

// Obtener productos para menú del día (después de rutas específicas)
router.get('/menu', productosController.getProductosParaMenu);

// Obtener producto por ID
router.get('/:id', productosController.getById);

// Crear producto
router.post('/', productosController.create);

// Actualizar producto
router.put('/:id', productosController.update);

// Toggle Activo
router.patch('/:id/activo', productosController.toggleActivo);

// Toggle Disponible en Menú
router.patch('/:id/disponible-en-menu', productosController.toggleDisponibleEnMenu);

// Eliminar producto (soft delete)
router.delete('/:id', productosController.remove);

module.exports = router;

// Obtener producto por ID (debe estar AL FINAL para no bloquear rutas específicas)
router.get('/:id', productosController.getById);

module.exports = router;