const express = require('express');
const ordenesController = require('../controllers/ordenes.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ⚠️ IMPORTANTE: Las rutas más específicas van PRIMERO en Express

// GET /api/ordenes/menu/productos - Obtener productos para Menú del Día (mesero, admin)
router.get('/menu/productos', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.getProductosParaMenu);

// GET /api/ordenes/mesa/:mesa_id - Ver orden activa por mesa (mesero)
router.get('/mesa/:mesa_id', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.getActivaPorMesa);

// GET /api/ordenes - Listar órdenes (mesero, cajero, admin)
router.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO, ROLES.MESERO), ordenesController.getAll);

// GET /api/ordenes/:id - Ver orden específica (mesero, cajero, admin)
router.get('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO, ROLES.MESERO), ordenesController.getById);

// POST /api/ordenes - Crear orden (mesero, admin)
router.post('/', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.create);

// POST /api/ordenes/:id/detalles - Agregar productos a orden (mesero, admin)
router.post('/:id/detalles', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.agregarDetalles);

// DELETE /api/ordenes/:id/detalles/:detalleId - Eliminar producto de orden (mesero, admin)
router.delete('/:id/detalles/:detalleId', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.eliminarDetalle);

// PUT /api/ordenes/:id/enviar-cocina - Enviar a cocina (mesero, admin)
router.put('/:id/enviar-cocina', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.enviarCocina);

// PUT /api/ordenes/:id/estado - Actualizar estado (mesero, admin)
router.put('/:id/estado', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.actualizarEstado);

// PUT /api/ordenes/:id/cancelar - Cancelar orden (mesero, admin)
router.put('/:id/cancelar', requireRole(ROLES.ADMINISTRADOR, ROLES.MESERO), ordenesController.cancelar);

// POST /api/ordenes/:id/cerrar - Cerrar orden y cobrar (cajero, admin)
router.post('/:id/cerrar', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), ordenesController.cerrar);

module.exports = router;