const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productos.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { validarCampos } = require('../middlewares/validation.middleware');

router.use(verificarToken);

router.get('/', productosController.obtenerTodos);
router.get('/:id', productosController.obtenerPorId);
router.get('/categoria/:categoria_id', productosController.obtenerPorCategoria);
router.post('/', verificarRol('admin'), validarCampos('nombre', 'precio_venta', 'categoria_id'), productosController.crear);
router.put('/:id', verificarRol('admin'), productosController.actualizar);
router.delete('/:id', verificarRol('admin'), productosController.eliminar);

// Recetas
router.get('/:id/receta', productosController.obtenerReceta);
router.post('/:id/receta', verificarRol('admin'), validarCampos('insumo_id', 'cantidad_requerida'), productosController.agregarReceta);
router.delete('/:id/receta/:insumo_id', verificarRol('admin'), productosController.eliminarReceta);

module.exports = router;