import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const COLORES = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function TopProductosChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No hay productos vendidos hoy</p>;
  }

  const chartData = data.map((item, index) => ({
    nombre: item.nombre.length > 18 ? item.nombre.substring(0, 18) + '...' : item.nombre,
    vendido: item.vendido,
    color: COLORES[index % COLORES.length]
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" fontSize={10} tick={{ fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis 
            dataKey="nombre" 
            type="category" 
            fontSize={11} 
            tick={{ fill: '#374151' }}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value) => [`${value} und.`, 'Vendidos']}
          />
          <Bar dataKey="vendido" radius={[0, 4, 4, 0]} barSize={16}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}