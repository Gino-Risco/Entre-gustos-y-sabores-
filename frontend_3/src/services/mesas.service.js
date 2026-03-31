// src/services/mesas.service.js
import api from './api';

export const mesasService = {
  async getAll(filtros = {}) {
    const response = await api.get('/mesas', { params: filtros });
    return response.data.data.mesas;
  },

  async getById(id) {
    const response = await api.get(`/mesas/${id}`);
    return response.data.data.mesa;
  },

  async create(data) {
    const response = await api.post('/mesas', data);
    return response.data.data.mesa;
  },

  async update(id, data) {
    const response = await api.put(`/mesas/${id}`, data);
    return response.data.data.mesa;
  },

  async delete(id) {
    const response = await api.delete(`/mesas/${id}`);
    return response.data.data;
  },

  async updateEstado(id, estado) {
    const response = await api.put(`/mesas/${id}/estado`, { estado });
    return response.data.data.mesa;
  },
};