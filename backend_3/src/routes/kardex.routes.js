const express = require('express');
const kardexController = require('../controllers/kardex.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación y solo administrador
router.use(authenticate);
router.use(requireRole(ROLES.ADMINISTRADOR));

// GET /api/kardex - Listar todos los movimientos
router.get('/', kardexController.getAll);

// GET /api/kardex/resumen - Resumen de movimientos por producto
router.get('/resumen', kardexController.getResumen);

// GET /api/kardex/valorizacion - Valorización de inventario
router.get('/valorizacion', kardexController.getValorizacion);

// GET /api/kardex/producto/:producto_id - Movimientos de un producto
router.get('/producto/:producto_id', kardexController.getPorProducto);

// GET /api/kardex/:id - Ver movimiento específico
router.get('/:id', kardexController.getById);

// POST /api/kardex/:id/revertir - Revertir movimiento
router.post('/:id/revertir', kardexController.revertir);

module.exports = router;