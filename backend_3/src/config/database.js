const { Pool } = require('pg');
require('dotenv').config();

// Pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'America/Lima'");
});

// Manejo de errores del pool
pool.on('error', (err) => {
  console.error('Error en pool de PostgreSQL:', err);
  process.exit(-1);
});

// Helpers para schemas (CRÍTICO: tus tablas están en pos/ e inventario/)
const SCHEMA = {
  POS: 'pos',
  INVENTARIO: 'inventario',
};

const TABLE = {
  // Schema POS
  USUARIOS: `${SCHEMA.POS}.usuarios`,
  ROLES: `${SCHEMA.POS}.roles`,
  MESAS: `${SCHEMA.POS}.mesas`,
  ORDENES: `${SCHEMA.POS}.ordenes`,
  ORDEN_DETALLES: `${SCHEMA.POS}.orden_detalles`,
  VENTAS: `${SCHEMA.POS}.ventas`,
  VENTAS_DETALLE: `${SCHEMA.POS}.ventas_detalle`,
  CAJA_APERTURAS: `${SCHEMA.POS}.caja_aperturas`,
  CAJA_MOVIMIENTOS: `${SCHEMA.POS}.caja_movimientos`,
  CAJA_CIERRES: `${SCHEMA.POS}.caja_cierres`,
  TICKETS_COCINA: `${SCHEMA.POS}.tickets_cocina`,
  CAJA_ARQUEOS: `${SCHEMA.POS}.caja_arqueos`,
  
  // Schema INVENTARIO
  PRODUCTOS: `${SCHEMA.INVENTARIO}.productos`,
  CATEGORIAS: `${SCHEMA.INVENTARIO}.categorias`,
  COMPRAS: `${SCHEMA.INVENTARIO}.compras`,
  COMPRAS_DETALLE: `${SCHEMA.INVENTARIO}.compras_detalle`,
  PROVEEDORES: `${SCHEMA.INVENTARIO}.proveedores`,
  KARDEX: `${SCHEMA.INVENTARIO}.kardex`,
  SALIDAS_COCINA: `${SCHEMA.INVENTARIO}.salidas_cocina`,
  SALIDAS_COCINA_DETALLE: `${SCHEMA.INVENTARIO}.salidas_cocina_detalle`,
  ALERTAS_STOCK: `${SCHEMA.INVENTARIO}.alertas_stock`,
};

// Función para ejecutar queries parametrizadas
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query ejecutada:', { text, duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Error ejecutando query:', { message: error.message, text });
    throw error;
  }
}

// Función para obtener cliente (para transacciones)
async function getClient() {
  const client = await pool.connect();
  const queryFn = client.query.bind(client);
  const releaseFn = client.release.bind(client);
  
  const timeout = setTimeout(() => {
    console.error('Cliente liberado por timeout de 30s');
    releaseFn();
  }, 30000);
  
  client.query = (...args) => {
    clearTimeout(timeout);
    return queryFn(...args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    return releaseFn();
  };
  
  return client;
}

// Health check
async function healthCheck() {
  try {
    await query('SELECT 1');
    return { status: 'healthy', database: 'connected' };
  } catch (error) {
    return { status: 'unhealthy', database: 'disconnected', error: error.message };
  }
}

// Cerrar pool
async function closePool() {
  await pool.end();
  console.log('Pool de PostgreSQL cerrado');
}

module.exports = {
  pool,
  query,
  getClient,
  healthCheck,
  closePool,
  SCHEMA,
  TABLE,
};