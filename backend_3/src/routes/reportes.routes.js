const express = require('express');
const reportesController = require('../controllers/reportes.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/reportes/dashboard - Resumen general (todos los roles)
router.get('/dashboard', reportesController.getDashboard);

// GET /api/reportes/ventas/periodo - Ventas por período (admin, cajero)
router.get('/ventas/periodo', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), reportesController.getVentasPorPeriodo);

// GET /api/reportes/ventas/productos - Productos más vendidos (admin, cajero)
router.get('/ventas/productos', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), reportesController.getProductosMasVendidos);

// GET /api/reportes/ventas/categoria - Ventas por categoría (admin, cajero)
router.get('/ventas/categoria', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), reportesController.getVentasPorCategoria);

// GET /api/reportes/ventas/metodo-pago - Ventas por método de pago (admin, cajero)
router.get('/ventas/metodo-pago', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), reportesController.getVentasPorMetodoPago);

// GET /api/reportes/ventas/mesa - Ventas por mesa (admin, cajero)
router.get('/ventas/mesa', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), reportesController.getVentasPorMesa);

// GET /api/reportes/ventas/mesero - Ventas por mesero (admin)
router.get('/ventas/mesero', requireRole(ROLES.ADMINISTRADOR), reportesController.getVentasPorMesero);

// GET /api/reportes/caja - Reporte de caja (admin, cajero)
router.get('/caja', requireRole(ROLES.ADMINISTRADOR, ROLES.CAJERO), reportesController.getCajaReporte);

// GET /api/reportes/alertas-stock - Alertas de stock pendientes (admin)
router.get('/alertas-stock', requireRole(ROLES.ADMINISTRADOR), reportesController.getAlertasStock);

module.exports = router;