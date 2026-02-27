const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  async login(usuario, password) {
    // Buscar usuario con JOIN a roles
    const result = await pool.query(
      `SELECT 
        u.id, 
        u.nombre_completo, 
        u.usuario, 
        u.password_hash, 
        u.activo, 
        u.password_hash_algorithm,
        r.id as rol_id,
        r.nombre as rol_nombre
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.usuario = $1 AND u.activo = true`,
      [usuario]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const user = result.rows[0];

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, user.password_hash);

    if (!passwordValido) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // Actualizar último acceso
    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generar token JWT (incluir rol_nombre)
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol_nombre, rol_id: user.rol_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    return {
      token,
      usuario: {
        id: user.id,
        nombre_completo: user.nombre_completo,
        usuario: user.usuario,
        rol: user.rol_nombre,
        rol_id: user.rol_id
      }
    };
  }

  async cambiarPassword(usuarioId, passwordActual, passwordNuevo) {
    const result = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const passwordValido = await bcrypt.compare(passwordActual, result.rows[0].password_hash);

    if (!passwordValido) {
      throw new Error('Contraseña actual incorrecta');
    }

    const passwordHash = await bcrypt.hash(passwordNuevo, 10);

    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
      [passwordHash, usuarioId]
    );

    return { message: 'Contraseña actualizada correctamente' };
  }
}

module.exports = new AuthService();