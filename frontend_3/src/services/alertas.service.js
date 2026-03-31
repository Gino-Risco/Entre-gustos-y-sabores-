import api from './api';

export const alertasService = {
  async getAllPendientes(tipo = 'todos') {
    const response = await api.get(`/alertas-stock${tipo !== 'todos' ? `?tipo=${tipo}` : ''}`);
    return response.data.data.alertas;
  },

  async marcarAtendida(id) {
    const response = await api.post(`/alertas-stock/${id}/atendida`);
    return response.data.data;
  },

  async getStockBajo() {
    const response = await api.get('/alertas-stock/stock-bajo');
    return response.data.data.productos;
  },
};