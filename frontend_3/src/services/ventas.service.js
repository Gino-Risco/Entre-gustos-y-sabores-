import api from './api';

export const ventasService = {
  /**
   * Obtener todas las ventas con filtros
   */
  async getAll(filtros = {}) {
    const response = await api.get('/ventas', { params: filtros });
    return response.data.data.ventas;
  },

  /**
   * Obtener venta por ID con detalles
   */
  async getById(id) {
    const response = await api.get(`/ventas/${id}`);
    return response.data.data.venta;
  },

  /**
   * Crear nueva venta (cobrar orden)
   * @param {Object} data - { orden_id, metodo_pago, monto_pagado, descuento?, observaciones? }
   */
  async crear(data) {
    const response = await api.post('/ventas', data);
    return response.data.data.venta;
  },

  /**
   * Anular venta (solo admin)
   */
  async anular(id, motivo) {
    const response = await api.put(`/ventas/${id}/anular`, { motivo });
    return response.data;
  },

  /**
   * Obtener datos para imprimir ticket
   */
  async getTicketData(id) {
    const response = await api.get(`/ventas/${id}/ticket`);
    return response.data.data;
  },

  /**
   * Obtener órdenes disponibles para cobrar
   * (estado IN: 'abierta', 'enviada_cocina', 'preparando', 'lista')
   */
  async getOrdenesPorCobrar() {
    const response = await api.get('/ordenes', {
      params: {
        incluir_cerradas: false,
      },
    });
    return response.data.data.ordenes;
  },

  /**
   * Obtener orden con detalles para mostrar en Ventas
   */
  async getOrdenParaCobrar(id) {
    const response = await api.get(`/ordenes/${id}`);
    return response.data.data.orden;
  },

  /**
   * Verificar si hay caja abierta
   */
  async verificarCajaAbierta() {
    const response = await api.get('/caja/estado');
    return response.data.data;
  },
};