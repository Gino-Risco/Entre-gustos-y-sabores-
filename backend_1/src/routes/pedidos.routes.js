const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidos.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/cocina', verificarRol('admin', 'cocina'), pedidosController.obtenerPedidosCocina);
router.get('/:id', pedidosController.obtenerPorId);
router.get('/mesa/:mesa_id', pedidosController.obtenerPorMesa);
router.post('/', verificarRol('admin', 'mesero'), pedidosController.crear);
router.put('/:pedido_id/detalles/:detalle_id/estado', verificarRol('admin', 'cocina'), pedidosController.actualizarEstadoDetalle);
router.put('/:id/cerrar', verificarRol('admin', 'cajero', 'mesero'), pedidosController.cerrarPedido);
router.put('/:id/cancelar', verificarRol('admin', 'cajero'), pedidosController.cancelarPedido);
router.post('/:id/pagos', verificarRol('admin', 'cajero'), pedidosController.agregarPago);
router.post('/:id/pagos/:pago_id/anular', verificarRol('admin'), pedidosController.anularPago);

module.exports = router;