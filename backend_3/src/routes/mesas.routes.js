const express = require('express');
const mesasController = require('../controllers/mesas.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/mesas - Listar (todos los roles)
router.get('/', mesasController.getAll);

// GET /api/mesas/:id - Ver una (todos los roles)
router.get('/:id', mesasController.getById);

// POST /api/mesas - Crear (solo admin)
router.post('/', requireRole(ROLES.ADMINISTRADOR), mesasController.create);

// PUT /api/mesas/:id - Actualizar (solo admin)
router.put('/:id', requireRole(ROLES.ADMINISTRADOR), mesasController.update);

// DELETE /api/mesas/:id - Desactivar (solo admin)
router.delete('/:id', requireRole(ROLES.ADMINISTRADOR), mesasController.remove);

// PUT /api/mesas/:id/estado - Cambiar estado (mesero, admin)
router.put('/:id/estado', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), mesasController.updateEstado);

module.exports = router;