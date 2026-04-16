const express = require('express');
const cajaController = require('../controllers/caja.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/caja/estado - Ver si hay caja abierta (cajero, admin)
router.get('/estado', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.obtenerEstado);

// GET /api/caja/fondo-sugerido - Obtener el monto que se dejó para apertura (cajero, admin)
router.get('/fondo-sugerido', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.obtenerFondoSugerido);

router.get('/resumen', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.getResumenDelDia);
router.get('/movimientos', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.getMovimientosDelDia);

// POST /api/caja/apertura - Abrir caja (cajero, admin)
router.post('/apertura', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.abrir);

// POST /api/caja/movimientos - Registrar retiro/gasto (cajero, admin)
router.post('/movimientos', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.registrarMovimiento);

// POST /api/caja/:id/arqueo - Registrar arqueo parcial / corte de caja (cajero, admin)
router.post('/:id/arqueo', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.registrarArqueoParcial);

// POST /api/caja/:id/cierre - Cerrar caja (cajero, admin)
router.post('/:id/cierre', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.cerrar);

// GET /api/caja/:caja_id/movimientos - Listar movimientos de una caja (cajero, admin)
router.get('/:caja_id/movimientos', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.obtenerMovimientos);

router.get('/historial', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), cajaController.obtenerHistorialCajas);

// GET /api/caja/reportes - Reporte de caja del día (admin)
router.get('/reportes', requireRole(ROLES.ADMINISTRADOR), cajaController.obtenerReporte);

module.exports = router;