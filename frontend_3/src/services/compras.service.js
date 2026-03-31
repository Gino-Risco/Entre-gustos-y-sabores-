// src/services/compras.service.js
import api from './api';

export const comprasService = {
  // Proveedores
  async getAllProveedores() {
    const response = await api.get('/compras/proveedores');
    return response.data.data.proveedores;
  },

  async getProveedorById(id) {
    const response = await api.get(`/compras/proveedores/${id}`);
    return response.data.data.proveedor;
  },

  async createProveedor(data) {
    const response = await api.post('/compras/proveedores', data);
    return response.data.data.proveedor;
  },

  async updateProveedor(id, data) {
    const response = await api.put(`/compras/proveedores/${id}`, data);
    return response.data.data.proveedor;
  },

  async deleteProveedor(id) {
    const response = await api.delete(`/compras/proveedores/${id}`);
    return response.data.data;
  },

  // Compras
  async getAllCompras(filtros = {}) {
    const response = await api.get('/compras', { params: filtros });
    return response.data.data.compras;
  },

  async getCompraById(id) {
    const response = await api.get(`/compras/${id}`);
    return response.data.data.compra;
  },

  async createCompra(data) {
    const response = await api.post('/compras', data);
    return response.data.data.compra;
  },

  async anularCompra(id, motivo) {
    const response = await api.post(`/compras/${id}/anular`, { motivo });
    return response.data.data;
  },
};