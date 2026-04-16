import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function VentasPorHoraChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No hay datos de ventas para hoy</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis 
            dataKey="hora_label" 
            fontSize={11} 
            tick={{ fill: '#6b7280' }}
            interval={2}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            fontSize={11} 
            tick={{ fill: '#6b7280' }}
            tickFormatter={(val) => `S/${val}`}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px'
            }}
            formatter={(value) => [`S/ ${value}`, 'Ingresos']}
            labelFormatter={(label) => `Hora: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="total_ingresos" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}