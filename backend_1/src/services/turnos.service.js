const pool = require('../config/db');

class TurnosService {
  async abrirTurno(usuario_id, monto_inicial) {
    // Verificar que no tenga un turno abierto
    const existente = await pool.query(
      "SELECT id FROM turnos_caja WHERE usuario_id = $1 AND estado = 'abierto'",
      [usuario_id]
    );

    if (existente.rows.length > 0) {
      throw new Error('Ya tiene un turno abierto. Debe cerrarlo antes de abrir uno nuevo.');
    }

    const result = await pool.query(
      `INSERT INTO turnos_caja (usuario_id, monto_inicial, estado) 
       VALUES ($1, $2, $3) RETURNING *`,
      [usuario_id, monto_inicial, 'abierto']
    );

    return result.rows[0];
  }

  async obtenerTurnoAbierto(usuario_id) {
    const result = await pool.query(
      "SELECT * FROM turnos_caja WHERE usuario_id = $1 AND estado = 'abierto'",
      [usuario_id]
    );

    return result.rows[0] || null;
  }

  async cerrarTurno(turno_id, monto_real, observaciones, usuario_id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que el turno existe y está abierto
      const turnoResult = await client.query(
        'SELECT * FROM turnos_caja WHERE id = $1 AND estado = $2',
        [turno_id, 'abierto']
      );

      if (turnoResult.rows.length === 0) {
        throw new Error('Turno no encontrado o ya está cerrado');
      }

      const turno = turnoResult.rows[0];

      // Calcular total en efectivo de pedidos cerrados del turno
      const efectivoResult = await client.query(
        `SELECT COALESCE(SUM(pa.monto), 0) as total_efectivo
         FROM pagos pa
         JOIN pedidos p ON pa.pedido_id = p.id
         WHERE p.turno_id = $1 AND p.estado = 'cerrado' AND pa.metodo_pago = 'efectivo'`,
        [turno_id]
      );

      const totalEfectivo = parseFloat(efectivoResult.rows[0].total_efectivo);
      const montoEsperado = parseFloat(turno.monto_inicial) + totalEfectivo;
      const diferencia = monto_real - montoEsperado;

      // Actualizar turno
      const result = await client.query(
        `UPDATE turnos_caja 
         SET fecha_cierre = CURRENT_TIMESTAMP,
             monto_final_esperado = $1,
             monto_final_real = $2,
             diferencia_caja = $3,
             observaciones_cierre = $4,
             estado = 'cerrado'
         WHERE id = $5 RETURNING *`,
        [montoEsperado, monto_real, diferencia, observaciones, turno_id]
      );

      await client.query('COMMIT');

      return {
        turno: result.rows[0],
        resumen: {
          monto_inicial: turno.monto_inicial,
          total_efectivo: totalEfectivo,
          monto_esperado: montoEsperado,
          monto_real: monto_real,
          diferencia: diferencia
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerHistorial(usuario_id, limite = 10) {
    const result = await pool.query(
      `SELECT * FROM turnos_caja 
       WHERE usuario_id = $1 
       ORDER BY fecha_apertura DESC 
       LIMIT $2`,
      [usuario_id, limite]
    );

    return result.rows;
  }
}

module.exports = new TurnosService();