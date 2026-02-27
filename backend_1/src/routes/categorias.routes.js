const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categorias.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { validarCampos } = require('../middlewares/validation.middleware');

router.use(verificarToken);

router.get('/', categoriasController.obtenerTodas);
router.get('/:id', categoriasController.obtenerPorId);
router.post('/', verificarRol('admin'), validarCampos('nombre'), categoriasController.crear);
router.put('/:id', verificarRol('admin'), categoriasController.actualizar);
router.delete('/:id', verificarRol('admin'), categoriasController.eliminar);

module.exports = router;