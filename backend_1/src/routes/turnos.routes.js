const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(verificarRol('admin', 'cajero'));

router.post('/abrir', turnosController.abrirTurno);
router.get('/abierto', turnosController.obtenerTurnoAbierto);
router.post('/cerrar', turnosController.cerrarTurno);
router.get('/historial', turnosController.obtenerHistorial);

module.exports = router;