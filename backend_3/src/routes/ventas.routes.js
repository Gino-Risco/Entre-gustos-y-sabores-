const express = require('express');
const ventasController = require('../controllers/ventas.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/ventas - Listar ventas (cajero, admin)
router.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), ventasController.getAll);

// GET /api/ventas/:id - Ver venta específica (cajero, admin)
router.get('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), ventasController.getById);

// GET /api/ventas/:id/ticket - Obtener datos para imprimir ticket (cajero, admin)
router.get('/:id/ticket', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), ventasController.getTicket);
// GET /api/ventas/por-cobrar - Obtener órdenes disponibles para cobrar
router.get('/por-cobrar', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), ventasController.getOrdenesPorCobrar);

// POST /api/ventas - Crear venta (cajero, admin)
router.post('/', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), ventasController.create);

// POST /api/ventas/:id/anular - Anular venta (solo admin)
router.post('/:id/anular', requireRole(ROLES.ADMINISTRADOR), ventasController.anular);

module.exports = router;