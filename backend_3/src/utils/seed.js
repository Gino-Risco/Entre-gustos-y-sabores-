const bcrypt = require('bcrypt');
const { query, TABLE } = require('../config/database');

async function crearAdmin() {
  try {
    // Verificar si ya existe admin
    const existing = await query(
      `SELECT id FROM ${TABLE.USUARIOS} WHERE usuario = $1`,
      ['admin']
    );

    if (existing.rows.length > 0) {
      console.log('✅ Usuario admin ya existe');
      return;
    }

    // Hash del password (bcrypt cost=12)
    const password = await bcrypt.hash('admin123', 12);

    // Obtener rol_id de administrador
    const rol = await query(
      `SELECT id FROM ${TABLE.ROLES} WHERE nombre = $1`,
      ['administrador']
    );

    if (rol.rows.length === 0) {
      console.error('❌ Rol administrador no encontrado');
      return;
    }

    // Crear usuario admin
    await query(
      `INSERT INTO ${TABLE.USUARIOS} (nombre, usuario, password, rol_id, activo)
       VALUES ($1, $2, $3, $4, TRUE)`,
      ['Administrador', 'admin', password, rol.rows[0].id]
    );

    console.log('✅ Usuario admin creado:');
    console.log('   Usuario: admin');
    console.log('   Password: admin123');
    console.log('   Rol: administrador');
  } catch (error) {
    console.error('❌ Error creando admin:', error.message);
  }
}

// Ejecutar si se corre directamente
if (require.main === module) {
  crearAdmin().then(() => process.exit(0));
}

module.exports = { crearAdmin };