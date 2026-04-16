const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const errorMiddleware = require('./middlewares/error.middleware');

// Rutas
const authRoutes = require('./routes/auth.routes');
const productosRoutes = require('./routes/productos.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const mesasRoutes = require('./routes/mesas.routes');
const ordenesRoutes = require('./routes/ordenes.routes');
const ventasRoutes = require('./routes/ventas.routes');
const cajaRoutes = require('./routes/caja.routes');
const comprasRoutes = require('./routes/compras.routes');
const salidasCocinaRoutes = require('./routes/salidas-cocina.routes');
const kardexRoutes = require('./routes/kardex.routes');
const reportesRoutes = require('./routes/reportes.routes');
const uploadRoutes = require('./routes/upload.routes');
const alertasStockRoutes = require('./routes/alertas-stock.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const app = express();

// Middleware global
app.use(helmet());

// 👇 NUEVA CONFIGURACIÓN DE CORS 👇
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.1.36:5173',
  'https://entre-gustos-y-sabores.vercel.app',
  process.env.FRONTEND_URL // Por si acaso tienes otra URL en tu .env
].filter(Boolean); // Elimina cualquier valor falso (como undefined)

app.use(cors({
  origin: function (origin, callback) {
    // Permitir si no hay origen (Postman) o si la URL está en nuestra lista VIP
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  credentials: true
}));
//  FIN DE LA NUEVA CONFIGURACIÓN 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: { message: 'Demasiadas solicitudes' } },
});
app.use('/api/', limiter);

// Health check
app.get('/health', async (req, res) => {
  const { healthCheck } = require('./config/database');
  const dbStatus = await healthCheck();
  res.json({
    success: true,
    message: 'API funcionando',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/mesas', mesasRoutes);
app.use('/api/ordenes', ordenesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/salidas-cocina', salidasCocinaRoutes);
app.use('/api/kardex', kardexRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/alertas-stock', alertasStockRoutes);
app.use('/api/usuarios', usuariosRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: 'Ruta no encontrada' } });
});

// Error handler (AL FINAL)
app.use(errorMiddleware);

module.exports = app;