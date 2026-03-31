const express = require('express');
const comprasController = require('../controllers/compras.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==========================================
// PROVEEDORES
// ==========================================

// GET /api/proveedores - Listar proveedores (admin)
router.get('/proveedores', requireRole(ROLES.ADMINISTRADOR), comprasController.getAllProveedores);

// GET /api/proveedores/:id - Ver proveedor (admin)
router.get('/proveedores/:id', requireRole(ROLES.ADMINISTRADOR), comprasController.getProveedorById);

// POST /api/proveedores - Crear proveedor (admin)
router.post('/proveedores', requireRole(ROLES.ADMINISTRADOR), comprasController.createProveedor);

// PUT /api/proveedores/:id - Actualizar proveedor (admin)
router.put('/proveedores/:id', requireRole(ROLES.ADMINISTRADOR), comprasController.updateProveedor);

// DELETE /api/proveedores/:id - Desactivar proveedor (admin)
router.delete('/proveedores/:id', requireRole(ROLES.ADMINISTRADOR), comprasController.deleteProveedor);

// ==========================================
// COMPRAS
// ==========================================

// GET /api/compras - Listar compras (admin)
router.get('/', requireRole(ROLES.ADMINISTRADOR), comprasController.getAllCompras);

// GET /api/compras/:id - Ver compra específica (admin)
router.get('/:id', requireRole(ROLES.ADMINISTRADOR), comprasController.getCompraById);

// POST /api/compras - Registrar compra (admin)
router.post('/', requireRole(ROLES.ADMINISTRADOR), comprasController.createCompra);

// POST /api/compras/:id/anular - Anular compra (admin)
router.post('/:id/anular', requireRole(ROLES.ADMINISTRADOR), comprasController.anularCompra);

module.exports = router;