const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/compras.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(verificarRol('admin', 'cajero'));

router.get('/', comprasController.obtenerTodas);
router.get('/:id', comprasController.obtenerPorId);
router.post('/', comprasController.crear);
router.post('/:id/completar', comprasController.completarCompra);
router.post('/:id/cancelar', comprasController.cancelarCompra);

module.exports = router;