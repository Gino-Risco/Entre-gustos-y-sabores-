import api from './api';

export const ordenesService = {
  async getAll(filtros = {}) {
    const response = await api.get('/ordenes', { params: filtros });
    return response.data.data.ordenes;
  },

  async getById(id) {
    const response = await api.get(`/ordenes/${id}`);
    return response.data.data.orden;
  },

  async getActivaPorMesa(mesaId) {
    const response = await api.get(`/ordenes/mesa/${mesaId}`);
    return response.data.data.orden;
  },

  async create(data) {
    const response = await api.post('/ordenes', data);
    return response.data.data.orden;
  },

  async agregarDetalles(id, detalles) {
    const response = await api.post(`/ordenes/${id}/detalles`, { detalles });
    return response.data.data.detalles;
  },

  async eliminarDetalle(ordenId, detalleId) {
    const response = await api.delete(`/ordenes/${ordenId}/detalles/${detalleId}`);
    return response.data.data;
  },

  async enviarCocina(id, observaciones) {
    const response = await api.put(`/ordenes/${id}/enviar-cocina`, { observaciones });
    return response.data.data;
  },

  async actualizarEstado(id, estado) {
    const response = await api.put(`/ordenes/${id}/estado`, { estado });
    return response.data.data.orden;
  },

  async cancelar(id, motivo) {
    const response = await api.put(`/ordenes/${id}/cancelar`, { motivo });
    return response.data.data.orden;
  },

  // NUEVA FUNCIÓN: Obtener productos para Menú del Día
  async getProductosParaMenu() {
    const response = await api.get('/ordenes/menu/productos');
    return response.data.data.productos;
  },

  // NUEVA FUNCIÓN: Cerrar orden y cobrar
  async cerrar(id, datosPago) {
    const response = await api.post(`/ordenes/${id}/cerrar`, datosPago);
    return response.data.data;
  },
};