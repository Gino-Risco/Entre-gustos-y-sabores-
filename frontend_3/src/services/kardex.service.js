// src/services/kardex.service.js
import api from './api';

export const kardexService = {
  async getAll(filtros = {}) {
    const response = await api.get('/kardex', { params: filtros });
    return response.data.data.kardex;
  },

  async getById(id) {
    const response = await api.get(`/kardex/${id}`);
    return response.data.data.movimiento;
  },

  async getPorProducto(productoId, limite = 100) {
    const response = await api.get(`/kardex/producto/${productoId}`, { params: { limite } });
    return response.data.data.kardex;
  },

  async revertir(id, motivo) {
    const response = await api.post(`/kardex/${id}/revertir`, { motivo });
    return response.data.data.movimiento;
  },

  async getResumen(fechaDesde, fechaHasta) {
    const response = await api.get('/kardex/resumen', { params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta } });
    return response.data.data.resumen;
  },

  async getValorizacion() {
    const response = await api.get('/kardex/valorizacion');
    return response.data.data.valorizacion;
  },
};