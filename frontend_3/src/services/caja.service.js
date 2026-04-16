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
   * Obtener el fondo sugerido para la apertura (basado en el último cierre)
   * GET /api/caja/fondo-sugerido
   */
  async obtenerFondoSugerido() {
    const response = await api.get('/caja/fondo-sugerido');
    return response.data.data.fondoSugerido;
  },

  /**
   * Abrir nueva caja
   * POST /api/caja/apertura
   */
  async abrirCaja(data) {
    // data debe incluir: { monto_inicial, observaciones }
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
   * Registrar arqueo parcial / corte de caja
   * POST /api/caja/:id/arqueo
   */
  async registrarArqueoParcial(cajaId, data) {
    // data debe incluir: { monto_contado, observaciones }
    const response = await api.post(`/caja/${cajaId}/arqueo`, data);
    return response.data.data;
  },

  /**
   * Cerrar caja (con turno)
   * POST /api/caja/:id/cierre
   */
  async cerrarCaja(cajaId, data) {
    // AHORA data debe incluir: { total_efectivo, total_tarjeta, total_otro, monto_final_real, fondo_reservado_proximo, observaciones }
    const response = await api.post(`/caja/${cajaId}/cierre`, data);
    return response.data.data; 
    // Nota: Retorno todo el objeto data porque incluye 'cierre' y 'alerta_diferencia', lo cual te servirá para mostrar alertas en React.
  },

  async getHistorialCajas() {
    const response = await api.get('/caja/historial');
    // Asumiendo que tu backend devuelve la data dentro de "cajas" o un array directo
    return response.data.data.cajas || response.data.data;
  },
};