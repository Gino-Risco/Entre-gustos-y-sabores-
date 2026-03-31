import api from './api';

export const productosService = {
  async getAll(filtros = {}) {
    const response = await api.get('/productos', { params: filtros });
    return response.data.data.productos;
  },

  async getById(id) {
    const response = await api.get(`/productos/${id}`);
    return response.data.data.producto;
  },

  async create(data) {
    const response = await api.post('/productos', data);
    return response.data.data.producto;
  },

  async update(id, data) {
    const response = await api.put(`/productos/${id}`, data);
    return response.data.data.producto;
  },

  async delete(id) {
    const response = await api.delete(`/productos/${id}`);
    return response.data.data;
  },

  async toggleActivo(id, activo) {
    const response = await api.patch(`/productos/${id}/activo`, { activo });
    return response.data.data.producto;
  },

  async toggleDisponibleEnMenu(id, disponible_en_menu) {
    const response = await api.patch(`/productos/${id}/disponible-en-menu`, { disponible_en_menu });
    return response.data.data.producto;
  },

  async getParaMenu() {
    const response = await api.get('/productos/menu');
    return response.data.data.productos;
  },

  async getStockBajo() {
    const response = await api.get('/productos/reportes/stock-bajo');
    return response.data.data.productos;
  },
};