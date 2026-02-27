const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const usuariosRoutes = require('./usuarios.routes');
const rolesRoutes = require('./roles.routes');
const mesasRoutes = require('./mesas.routes');
const categoriasRoutes = require('./categorias.routes');
const productosRoutes = require('./productos.routes');
const comprasRoutes = require('./compras.routes');
const comprobantesRoutes = require('./comprobantes.routes');
const pedidosRoutes = require('./pedidos.routes');
const turnosRoutes = require('./turnos.routes');
const reportesRoutes = require('./reportes.routes');

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/roles', rolesRoutes);
router.use('/mesas', mesasRoutes);
router.use('/categorias', categoriasRoutes);
router.use('/productos', productosRoutes);
router.use('/compras', comprasRoutes);
router.use('/comprobantes', comprobantesRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/turnos', turnosRoutes);
router.use('/reportes', reportesRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Restaurante MAX v2.0',
    version: '2.0.0',
    database: 'restaurante_max',
    endpoints: {
      auth: '/api/auth',
      usuarios: '/api/usuarios',
      roles: '/api/roles',
      mesas: '/api/mesas',
      categorias: '/api/categorias',
      productos: '/api/productos',
      compras: '/api/compras',
      comprobantes: '/api/comprobantes',
      pedidos: '/api/pedidos',
      turnos: '/api/turnos',
      reportes: '/api/reportes'
    }
  });
});

module.exports = router;