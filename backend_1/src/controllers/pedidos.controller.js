const pedidosService = require('../services/pedidos.service');

const pedidosController = {
  crear: async (req, res) => {
    try {
      const { mesa_id, turno_id, detalles } = req.body;

      if (!mesa_id || !turno_id || !detalles || detalles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Mesa, turno y detalles del pedido son requeridos'
        });
      }

      const pedido = await pedidosService.crear({
        mesa_id,
        mesero_id: req.usuario.id,
        turno_id,
        detalles
      });

      res.status(201).json({ success: true, data: pedido });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const pedido = await pedidosService.obtenerPorId(req.params.id);
      res.json({ success: true, data: pedido });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  obtenerPorMesa: async (req, res) => {
    try {
      const pedidos = await pedidosService.obtenerPorMesa(req.params.mesa_id);
      res.json({ success: true, data: pedidos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  actualizarEstadoDetalle: async (req, res) => {
    try {
      const { pedido_id, detalle_id } = req.params;
      const { estado_cocina } = req.body;

      const detalle = await pedidosService.actualizarEstadoDetalle(
        pedido_id,
        detalle_id,
        estado_cocina,
        req.usuario.id
      );

      res.json({ success: true, data: detalle });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  cerrarPedido: async (req, res) => {
    try {
      const pedido = await pedidosService.cerrarPedido(req.params.id, req.usuario.id);
      res.json({ success: true, data: pedido });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  agregarPago: async (req, res) => {
    try {
      const { monto, metodo_pago, referencia_pago } = req.body;

      if (!monto || !metodo_pago) {
        return res.status(400).json({
          success: false,
          message: 'Monto y método de pago son requeridos'
        });
      }

      const pago = await pedidosService.agregarPago(req.params.id, {
        monto,
        metodo_pago,
        referencia_pago,
        usuario_id: req.usuario.id
      });

      res.status(201).json({ success: true, data: pago });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  obtenerPedidosCocina: async (req, res) => {
    try {
      const pedidos = await pedidosService.obtenerPedidosCocina();
      res.json({ success: true, data: pedidos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = pedidosController;