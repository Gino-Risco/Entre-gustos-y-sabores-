const express = require('express');
const router = express.Router();
const mesasController = require('../controllers/mesas.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { validarCampos } = require('../middlewares/validation.middleware');

router.use(verificarToken);

router.get('/', mesasController.obtenerTodas);
router.get('/disponibles', mesasController.obtenerDisponibles);
router.get('/:id', mesasController.obtenerPorId);
router.post('/', verificarRol('admin', 'cajero'), validarCampos('nombre', 'capacidad'), mesasController.crear);
router.put('/:id', verificarRol('admin', 'cajero'), mesasController.actualizar);
router.put('/:id/estado', verificarRol('admin', 'cajero', 'mesero'), mesasController.actualizarEstado);
router.delete('/:id', verificarRol('admin'), mesasController.eliminar);

module.exports = router;