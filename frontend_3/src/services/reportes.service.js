// src/services/reportes.service.js
import api from './api';

export const reportesService = {
  async getDashboard() {
    const response = await api.get('/reportes/dashboard', {
      params: {
        fecha_desde: new Date().toISOString().split('T')[0],
        fecha_hasta: new Date().toISOString().split('T')[0],
      },
    });
    return response.data.data.dashboard;
  },

  async getVentasPorPeriodo(fechaDesde, fechaHasta, agruparPor = 'dia') {
    const response = await api.get('/reportes/ventas/periodo', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, agrupar_por: agruparPor },
    });
    return response.data.data.reporte;
  },

  async getProductosMasVendidos(fechaDesde, fechaHasta, limite = 20) {
    const response = await api.get('/reportes/ventas/productos', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, limite },
    });
    return response.data.data.reporte;
  },

  async getVentasPorCategoria(fechaDesde, fechaHasta) {
    const response = await api.get('/reportes/ventas/categoria', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    });
    return response.data.data.reporte;
  },

  async getVentasPorMetodoPago(fechaDesde, fechaHasta) {
    const response = await api.get('/reportes/ventas/metodo-pago', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    });
    return response.data.data.reporte;
  },

  async getVentasPorMesa(fechaDesde, fechaHasta) {
    const response = await api.get('/reportes/ventas/mesa', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    });
    return response.data.data.reporte;
  },

  async getVentasPorMesero(fechaDesde, fechaHasta) {
    const response = await api.get('/reportes/ventas/mesero', {
      params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
    });
    return response.data.data.reporte;
  },

  async getCajaReporte(fecha) {
    const response = await api.get('/reportes/caja', {
      params: { fecha: fecha || new Date().toISOString().split('T')[0] },
    });
    return response.data.data.reporte;
  },

  async getAlertasStock() {
    const response = await api.get('/reportes/alertas-stock');
    return response.data.data.alertas;
  },
};