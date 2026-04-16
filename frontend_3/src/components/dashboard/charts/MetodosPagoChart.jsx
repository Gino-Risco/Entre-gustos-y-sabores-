import React from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const COLORES = {
  efectivo: '#22c55e',
  tarjeta: '#3b82f6',
  yape: '#a855f7',
  plin: '#ec4899',
  mixto: '#f59e0b'
};

export default function MetodosPagoChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">No hay métodos de pago registrados hoy</p>;
  }

  const chartData = data.map(item => ({
    name: item.label,
    value: item.value,
    color: COLORES[item.metodo] || '#94a3b8'
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value) => [`S/ ${value}`, 'Total']}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', color: '#4b5563' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}