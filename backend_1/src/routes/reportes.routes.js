const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(verificarRol('admin', 'cajero'));

router.get('/ventas/dia', reportesController.ventasPorDia);
router.get('/productos/mas-vendidos', reportesController.productosMasVendidos);
router.get('/ventas/metodo-pago', reportesController.ventasPorMetodoPago);
router.get('/turno/:turno_id', reportesController.resumenTurno);
router.get('/inventario/stock-critico', reportesController.stockCritico);
router.get('/inventario/valorizado', reportesController.inventarioValorizado);

module.exports = router;