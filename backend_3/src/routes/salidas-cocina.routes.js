const express = require('express');
const salidasCocinaController = require('../controllers/salidas-cocina.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/salidas-cocina - Listar salidas (admin)
router.get('/', requireRole(ROLES.ADMINISTRADOR), salidasCocinaController.getAll);

// GET /api/salidas-cocina/pendientes - Listar salidas pendientes de aprobación (admin)
router.get('/pendientes', requireRole(ROLES.ADMINISTRADOR), salidasCocinaController.getPendientes);

// GET /api/salidas-cocina/:id - Ver salida específica (admin)
router.get('/:id', requireRole(ROLES.ADMINISTRADOR), salidasCocinaController.getById);

// POST /api/salidas-cocina - Registrar salida (admin)
router.post('/', requireRole(ROLES.ADMINISTRADOR), salidasCocinaController.crear);

// POST /api/salidas-cocina/:id/aprobar - Aprobar salida (descuenta stock) (admin)
router.post('/:id/aprobar', requireRole(ROLES.ADMINISTRADOR), salidasCocinaController.aprobar);

// POST /api/salidas-cocina/:id/revertir - Revertir salida aprobada (admin)
router.post('/:id/revertir', requireRole(ROLES.ADMINISTRADOR), salidasCocinaController.revertir);

module.exports = router;