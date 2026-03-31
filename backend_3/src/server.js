const app = require('./app');
const { closePool } = require('./config/database');

const PORT = process.env.PORT || 3000;

// 👇 AQUÍ ESTÁ LA MAGIA: Agregamos '0.0.0.0' 👇
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT} abierto a la red local`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Cierre graceful
process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  server.close(() => {
    closePool();
    console.log('Conexiones cerradas');
    process.exit(0);
  });
});

module.exports = server;