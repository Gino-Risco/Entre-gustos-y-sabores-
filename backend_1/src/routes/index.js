const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const mesasRoutes = require('./mesas.routes');
const pedidosRoutes = require('./pedidos.routes');
const turnosRoutes = require('./turnos.routes');

router.use('/auth', authRoutes);
router.use('/mesas', mesasRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/turnos', turnosRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Restaurante POS v1.0',
    endpoints: {
      auth: '/api/auth',
      mesas: '/api/mesas',
      pedidos: '/api/pedidos',
      turnos: '/api/turnos'
    }
  });
});

module.exports = router;