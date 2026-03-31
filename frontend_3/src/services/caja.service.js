import api from './api';

export const cajaService = {
  /**
   * Verificar si hay caja abierta
   * GET /api/caja/estado
   */
  async verificarCajaAbierta() {
    const response = await api.get('/caja/estado');
    // Tu controller retorna: { caja_abierta: boolean, caja: {...} }
    return response.data.data;
  },

  /**
   * Abrir nueva caja
   * POST /api/caja/apertura  ← ¡CORREGIDO! (no era /abrir)
   */
  async abrirCaja(data) {
    const response = await api.post('/caja/apertura', data);
    return response.data.data.caja;
  },

  /**
   * Obtener resumen del día (cards + totales)
   * GET /api/caja/resumen
   */
  async getResumenDelDia() {
    const response = await api.get('/caja/resumen');
    return response.data.data.resumen;
  },

  /**
   * Obtener historial de movimientos
   * GET /api/caja/movimientos
   */
  async getMovimientosDelDia(cajaId, filtros = {}) {
    const response = await api.get('/caja/movimientos', { params: filtros });
    return response.data.data.movimientos;
  },

  /**
   * Registrar movimiento manual (ingreso/egreso)
   * POST /api/caja/movimientos
   */
  async registrarMovimiento(data) {
    // data debe incluir: { caja_id, tipo, descripcion, monto }
    const response = await api.post('/caja/movimientos', data);
    return response.data.data.movimiento;
  },

  /**
   * Cerrar caja (con turno)
   * POST /api/caja/:id/cierre
   */
  async cerrarCaja(cajaId, data) {
    const response = await api.post(`/caja/${cajaId}/cierre`, data);
    return response.data.data.cierre;
  },
};