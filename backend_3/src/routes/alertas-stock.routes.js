const express = require('express');
const alertasController = require('../controllers/alertas.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();
router.use(authenticate);

// GET /api/alertas-stock - Listar alertas (todos los roles)
router.get('/', alertasController.getAll);

// GET /api/alertas-stock/stock-bajo - Productos con stock bajo (admin, cajero)
router.get('/stock-bajo', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), alertasController.getStockBajo);

// POST /api/alertas-stock/:id/atendida - Marcar como atendida (admin, cajero)
router.post('/:id/atendida', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), alertasController.marcarAtendida);

module.exports = router;