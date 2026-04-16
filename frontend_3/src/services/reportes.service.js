// src/services/reportes.service.js
import api from './api';

export const reportesService = {
  async getDashboard() {
    // ✅ FIX: Usar zona horaria de Perú, no UTC
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    const response = await api.get('/reportes/dashboard', {
      params: {
        fecha_desde: hoy,
        fecha_hasta: hoy,
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
    // ✅ FIX: Usar zona horaria de Perú
    const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    const response = await api.get('/reportes/caja', {
      params: { fecha: fechaConsulta },
    });
    return response.data.data.reporte;
  },

  async getAlertasStock() {
    const response = await api.get('/reportes/alertas-stock');
    return response.data.data.alertas;
  },

  async getVentasPorHora(fecha) {
    // ✅ FIX: Usar zona horaria de Perú
    const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    const response = await api.get('/reportes/dashboard/ventas-hora', {
      params: { fecha: fechaConsulta },
    });
    return response.data.data.ventas_por_hora;
  },

  async getMetodosPago(fecha) {
    // ✅ FIX: Usar zona horaria de Perú
    const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    const response = await api.get('/reportes/dashboard/metodos-pago', {
      params: { fecha: fechaConsulta },
    });
    return response.data.data.metodos_pago;
  },

  async getTopProductos(fecha, limite = 5) {
    // ✅ FIX: Usar zona horaria de Perú
    const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    const response = await api.get('/reportes/dashboard/top-productos', {
      params: {
        fecha: fechaConsulta,
        limite
      },
    });
    return response.data.data.top_productos;
  },

  async getOrdenesActivas(limite = 5) {
    const response = await api.get('/reportes/dashboard/ordenes-activas', {
      params: { limite },
    });
    return response.data.data.ordenes;
  },
};