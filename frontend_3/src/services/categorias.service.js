// src/services/categorias.service.js
import api from './api';

export const categoriasService = {
  async getAll(filtros = {}) {
    const response = await api.get('/categorias', { params: filtros });
    return response.data.data.categorias;
  },

  async getById(id) {
    const response = await api.get(`/categorias/${id}`);
    return response.data.data.categoria;
  },

  async create(data) {
    const response = await api.post('/categorias', data);
    return response.data.data.categoria;
  },

  async update(id, data) {
    const response = await api.put(`/categorias/${id}`, data);
    return response.data.data.categoria;
  },

  async delete(id) {
    const response = await api.delete(`/categorias/${id}`);
    return response.data.data;
  },
};