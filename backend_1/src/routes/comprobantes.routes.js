const express = require('express');
const router = express.Router();
const comprobantesController = require('../controllers/comprobantes.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(verificarRol('admin', 'cajero'));

router.get('/', comprobantesController.obtenerTodos);
router.get('/:id', comprobantesController.obtenerPorId);
router.post('/', comprobantesController.crear);
router.post('/:id/anular', comprobantesController.anular);

module.exports = router;