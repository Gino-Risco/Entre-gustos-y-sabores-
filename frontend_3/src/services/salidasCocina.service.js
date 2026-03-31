import api from './api';

export const salidasCocinaService = {
  // Aquí estaba el error, antes decía /inventario/salidas
  getAll: async (filtros = {}) => {
    const response = await api.get('/salidas-cocina', { params: filtros });
    return response.data.data; 
  },

  getById: async (id) => {
    const response = await api.get(`/salidas-cocina/${id}`);
    return response.data.data;
  },

  create: async (data) => {
    const response = await api.post('/salidas-cocina', data);
    return response.data.data;
  },

  aprobar: async (id) => {
    const response = await api.post(`/salidas-cocina/${id}/aprobar`);
    return response.data.data;
  }
};