const express = require('express');
const categoriasController = require('../controllers/categorias.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/categorias - Listar (todos los roles)
router.get('/', categoriasController.getAll);

// GET /api/categorias/:id - Ver uno (todos los roles)
router.get('/:id', categoriasController.getById);

// POST /api/categorias - Crear (solo admin)
router.post('/', requireRole(ROLES.ADMINISTRADOR), categoriasController.create);

// PUT /api/categorias/:id - Actualizar (solo admin)
router.put('/:id', requireRole(ROLES.ADMINISTRADOR), categoriasController.update);

// DELETE /api/categorias/:id - Desactivar (solo admin)
router.delete('/:id', requireRole(ROLES.ADMINISTRADOR), categoriasController.remove);

module.exports = router;