// scripts/seed-admin.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function seedRoles() {
  const client = await pool.connect();
  
  try {
    // Roles por defecto del sistema
    const roles = [
      { nombre: 'admin', descripcion: 'Administrador del sistema' },
      { nombre: 'cajero', descripcion: 'Encargado de caja y cobros' },
      { nombre: 'mesero', descripcion: 'Personal de atención al cliente' },
      { nombre: 'cocina', descripcion: 'Personal de preparación de alimentos' }
    ];

    for (const rol of roles) {
      // Verificar si ya existe
      const existe = await client.query(
        'SELECT id FROM roles WHERE nombre = $1',
        [rol.nombre]
      );

      if (existe.rows.length === 0) {
        await client.query(
          'INSERT INTO roles (nombre, descripcion, activo) VALUES ($1, $2, $3)',
          [rol.nombre, rol.descripcion, true]
        );
        console.log(`✅ Rol creado: ${rol.nombre}`);
      }
    }
  } finally {
    client.release();
  }
}

async function crearAdmin() {
  const client = await pool.connect();
  
  try {
    // 1. Primero asegurar que los roles existen
    await seedRoles();

    // 2. Obtener el ID del rol 'admin'
    const rolResult = await client.query(
      'SELECT id FROM roles WHERE nombre = $1 AND activo = true',
      ['admin']
    );

    if (rolResult.rows.length === 0) {
      throw new Error('No se encontró el rol "admin" en la base de datos');
    }

    const rol_id = rolResult.rows[0].id;

    // 3. Datos del administrador
    const nombre_completo = 'Administrador General';
    const usuario = 'admin';
    const password = 'admin123'; // ⚠️ CAMBIA ESTO EN PRODUCCIÓN

    // 4. Verificar si ya existe el usuario
    const existe = await client.query(
      'SELECT id FROM usuarios WHERE usuario = $1',
      [usuario]
    );

    if (existe.rows.length > 0) {
      console.log('⚠️  El usuario admin ya existe. Actualizando contraseña...');
      
      const hash = await bcrypt.hash(password, 10);
      await client.query(
        'UPDATE usuarios SET password_hash = $1 WHERE usuario = $2',
        [hash, usuario]
      );
      
      console.log('✅ Contraseña de admin actualizada correctamente');
    } else {
      // 5. Crear nuevo administrador (CON rol_id, NO rol)
      const hash = await bcrypt.hash(password, 10);
      
      await client.query(
        `INSERT INTO usuarios 
         (nombre_completo, usuario, password_hash, rol_id, password_hash_algorithm, activo) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [nombre_completo, usuario, hash, rol_id, 'bcrypt', true]
      );
      
      console.log('✅ Usuario administrador creado correctamente');
    }

    console.log(`\n📋 Credenciales:`);
    console.log(`   Usuario: ${usuario}`);
    console.log(`   Password: ${password}`);
    console.log(`   Rol: admin (ID: ${rol_id})`);

  } catch (error) {
    console.error('❌ Error creando el administrador:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
crearAdmin()
  .then(() => {
    console.log('\n🎉 Script completado exitosamente');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Script fallido:', err.message);
    process.exit(1);
  });